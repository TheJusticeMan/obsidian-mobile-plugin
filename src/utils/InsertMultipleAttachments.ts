import { App, Editor } from 'obsidian';

export class FilesSel {
  private readonly fileEl: HTMLInputElement;

  public constructor(
    private readonly app: App,
    private readonly editor: Editor,
    accept?: string,
  ) {
    this.fileEl = document.body.createEl('input', {
      attr: { multiple: '' },
      type: 'file',
    });
    if (accept) this.fileEl.setAttribute('accept', accept);
    this.fileEl.setCssProps({ position: 'fixed', opacity: '0' });
    this.fileEl.addEventListener('change', this.handleChange);
    this.fileEl.addEventListener('cancel', () => this.fileEl.remove());
    this.fileEl.focus();
    this.fileEl.click();
  }

  private handleChange = () => {
    const activeFile = this.app.workspace.getActiveFile();

    if (!this.fileEl.files || !activeFile) return this.fileEl.remove();

    void Promise.all(
      Array.from(this.fileEl.files).map(async file =>
        this.app.fileManager
          .generateMarkdownLink(
            await this.app.vault.createBinary(
              await this.app.fileManager.getAvailablePathForAttachment(
                file.name.replace(/.+(\\|\/)/g, ''),
                activeFile.path,
              ),
              await file.arrayBuffer(),
            ),
            activeFile.path,
          )
          .replace(/^([^!])/, '!$1'),
      ),
    )
      .then(links => this.editor.replaceSelection(links.join('\n')))
      .finally(() => this.fileEl.remove());
  };
}
