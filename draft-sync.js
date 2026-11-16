'use strict';

class SharedDraftSync {
  constructor({ metadata, loadLocal, saveLocal, accept, backup, show }) {
    this.meta = metadata;
    this.loadLocal = loadLocal;
    this.saveLocal = saveLocal;
    this.accept = accept;
    this.backup = backup;
    this.show = show;
    this.account = '';
    this.api = null;
    this.task = null;
    this.ready = false;
    this.empty = false;
    this.conflict = false;
    this.dirtyForm = false;
  }

  status(message, tone = '') {
    this.show({
      message, tone,
      busy: Boolean(this.task),
      initialize: Boolean(this.account && this.empty && !this.meta.revision),
      refresh: Boolean(this.account),
      synchronized: Boolean(this.account && this.ready && this.meta.revision && !this.meta.pending && !this.conflict),
    });
  }

  async connect(account, api, active) {
    const changed = this.account !== account;
    this.account = account;
    this.api = account ? api : null;
    if (changed) {
      this.ready = false;
      this.empty = false;
      this.conflict = false;
    }
    if (!this.account) {
      this.status('Supabase接続で管理者ログインすると、端末間で下書きを同期できます。', 'warning');
      return;
    }
    if (active && (changed || !this.ready)) return this.refresh();
  }

  canPublish() {
    return Boolean(this.account && this.ready && this.meta.revision && !this.meta.pending && !this.conflict && !this.task && !this.dirtyForm);
  }

  setDirtyForm(dirty) {
    if (this.dirtyForm === dirty) return;
    this.dirtyForm = dirty;
    this.show({ busy:Boolean(this.task), synchronized:this.canPublish() });
  }

  record() {
    const metadata = { ...this.meta, pending:true, writeId:crypto.randomUUID() };
    this.saveLocal(metadata);
    this.meta = metadata;
    if (this.conflict) {
      this.status('別端末の更新があるため未同期です。この端末の変更は残っています。', 'warning');
    } else if (this.account && this.ready && this.meta.revision) {
      if (!this.task) void this.flush();
      else this.status('共有下書きに保存しています…');
    } else if (this.empty) {
      this.status('初回設定待ち。この端末の下書きを確認してから共有を開始してください。', 'warning');
    } else {
      this.status('未同期。この端末に保存しました。管理者ログイン後に共有下書きを確認してください。', 'warning');
    }
  }

  async run(work, { flushAfter = true } = {}) {
    if (this.task) return this.task;
    const api = this.api;
    if (!api) return;
    // A response from a previous login must not be applied to a different account.
    const account = this.account;
    const current = () => this.account === account && this.api === api;
    this.task = Promise.resolve().then(async () => {
      try {
        await work(api, current);
      } catch (error) {
        if (!current()) return;
        if (error.message.includes('OFES_DRAFT_CONFLICT')) {
          this.conflict = true;
          this.status('別端末で下書きが更新されました。この端末の変更を残しました。JSONを書き出すか、共有下書きを確認してください。', 'warning');
        } else {
          this.ready = false;
          this.status(error.message, 'warning');
        }
      }
    });
    try {
      await this.task;
    } finally {
      this.task = null;
      this.show({ busy:false, synchronized:this.canPublish() });
      if (!current() && this.account) void this.refresh();
      else if (current() && flushAfter && this.ready && this.meta.revision && this.meta.pending && !this.conflict) void this.flush();
    }
  }

  async refresh({ replace = false, automatic = false } = {}) {
    if (!this.account || this.task || (automatic && this.dirtyForm)) return;
    return this.run(async (api, current) => {
      this.status('共有下書きを確認しています…');
      const row = await api.read();
      if (!current()) return;
      this.ready = true;
      this.empty = !row;
      if (!row) {
        this.conflict = Boolean(this.meta.revision);
        this.status(this.conflict
          ? '共有下書きが見つかりません。この端末の下書きは保持しています。'
          : '共有下書きはまだありません。最新の下書きがある端末で「この端末の下書きから共有を開始」を押してください。', 'warning');
        return;
      }

      const revision = Number(row.revision);
      if (!replace && this.meta.pending && row.write_id === this.meta.writeId) {
        this.markSaved(row);
        return;
      }
      if (revision === this.meta.revision && (!replace || !this.meta.pending)) {
        this.conflict = false;
        if (this.meta.pending) this.status('この端末の変更を同期しています…');
        else this.synced(row.updated_at);
        return;
      }

      const keepLocal = this.meta.pending || (!this.meta.revision && this.loadLocal().legacy);
      if (!replace && this.meta.revision && keepLocal) {
        this.conflict = true;
        this.status('この端末と共有下書きの両方に変更があります。端末の変更は保持しています。', 'warning');
        return;
      }
      if (this.dirtyForm) {
        this.ready = false;
        this.status('別端末の更新があります。入力中の欄を保存するか、共有下書きを開き直してください。', 'warning');
        return;
      }
      if (keepLocal) this.backup();
      const metadata = { revision, pending:false, writeId:row.write_id };
      this.accept(row.payload, metadata);
      this.meta = metadata;
      this.conflict = false;
      this.synced(row.updated_at, keepLocal ? '以前の端末下書きは「切替前のJSON」に保存しました。' : '');
    });
  }

  synced(updatedAt, suffix = '') {
    const time = new Date(updatedAt).toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
    this.status(`同期済み ${time}${suffix ? '。'+suffix : ''}`, 'ok');
  }

  markSaved(result, sentId = this.meta.writeId) {
    const same = this.meta.writeId === sentId;
    const metadata = { ...this.meta, revision:Number(result.revision), pending:!same };
    this.saveLocal(metadata);
    this.meta = metadata;
    if (same) this.synced(result.updated_at);
  }

  async flush(initial = false) {
    if (!this.account || !this.ready || this.conflict || this.task) return;
    if (initial ? !this.empty || this.meta.revision : !this.meta.revision || !this.meta.pending) return;
    return this.run(async (api, current) => {
      this.status('共有下書きに保存しています…');
      const { payload } = this.loadLocal();
      const writeId = this.meta.writeId || crypto.randomUUID();
      if (!this.meta.writeId) {
        this.meta = { ...this.meta, writeId, pending:true };
        this.saveLocal(this.meta);
      }
      const saved = await api.save(payload, this.meta.revision || 0, writeId);
      if (!current()) return;
      this.empty = false;
      this.markSaved(saved, writeId);
    });
  }
}
