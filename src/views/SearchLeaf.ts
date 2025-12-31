import apocalypseThrottle from 'apocalypse-throttle';
import {
  App,
  ButtonComponent,
  Component,
  ExtraButtonComponent,
  IconName,
  ItemView,
  MarkdownRenderer,
  Menu,
  Modal,
  SearchComponent,
  Setting,
  TAbstractFile,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from 'obsidian';
import MobilePlugin from '../main';

export const VIEW_TYPE_SEARCH = 'mobile-search-view';

const PREVIEW_LENGTH = 200;

/**
 * Custom view for mobile-optimized file search and navigation.
 *
 * Provides a fast, touch-friendly interface for searching and opening files
 * with features including:
 * - Instant search with fuzzy matching
 * - File previews with lazy loading
 * - Batch selection and operations
 * - Folder filtering
 * - Context menus for file actions
 *
 * @extends ItemView
 */
export class SearchLeaf extends ItemView {
  private filesCache: FilesCache;

  searchInput: SearchBar;
  resultsCtr: ResultsCtr;
  app: App;
  selectionCommandBar: SelectionCommandBar;
  searchContainer: HTMLDivElement;
  filesInSearch: TFile[] = [];
  intersectionObserver: IntersectionObserver;
  mode: 'files' | 'folders' = 'files';

  constructor(
    leaf: WorkspaceLeaf,
    public plugin: MobilePlugin,
  ) {
    super(leaf);
    this.app = this.plugin.app;
    this.filesCache = new FilesCache(this);
  }

  getViewType(): string {
    return VIEW_TYPE_SEARCH;
  }

  getDisplayText(): string {
    return 'Quick search';
  }

  getIcon(): IconName {
    return 'search';
  }

  protected onOpen(): Promise<void> {
    const { contentEl } = this;

    contentEl.empty();
    contentEl.addClass('mobile-search-view');

    this.searchContainer = contentEl.createDiv('mobile-search-input-container');

    this.searchInput = new SearchBar(this.searchContainer)
      .setPlaceholder('Search files...')
      .onBlur(() => {})
      .onFocus(() => (this.resultsCtr.resultsEl.scrollTop = 0))
      .onChange((query: string) => void this.update(query));

    this.searchInput.inputEl.addEventListener(
      'keydown',
      (event: KeyboardEvent) => {
        if (event.key === 'Backspace' && this.searchInput.getValue() === '') {
          if (this.mode === 'folders') {
            this.filesCache.folder = null;
            this.mode = 'files';
          } else this.mode = 'folders';
          void this.update();
        }
      },
    );

    // Create selection command bar (hidden by default)
    this.selectionCommandBar = new SelectionCommandBar(this, contentEl);

    //this.setupSelectionCommandBar();

    this.resultsCtr = new ResultsCtr(this, contentEl, this.filesCache)
      .onTouchMove(() => this.searchInput.blur())
      .onBackAtTop(() => this.searchInput.focus())
      .onScroll(() => void this.checkScroll());

    this.filesCache.onUpdate(
      () => void this.update(this.searchInput.getValue()),
    );

    this.addChild(this.resultsCtr);
    this.addChild(this.filesCache);
    this.setupIntersectionObserver();

    void this.update();
    return Promise.resolve();
  }

  protected onClose(): Promise<void> {
    this.removeChild(this.filesCache);
    return Promise.resolve();
  }

  /**
   * Updates the search results based on the current query.
   *
   * Filters files and folders according to the search input,
   * updates the results container, and handles special modes
   * for folder navigation. Also displays open tabs if enabled
   * in settings.
   *
   * @param query - The current search query string.
   */
  update = apocalypseThrottle((query: string = '') => {
    this.removeChild(this.resultsCtr);
    this.addChild(this.resultsCtr);

    this.searchInput.setPlaceholder(
      `Search ${(this.mode === 'files' && this.filesCache.folder?.path) || this.mode}...`,
    );

    const lowerCaseQuery = query.toLowerCase();
    if (this.mode === 'folders') {
      return void this.showFolders(lowerCaseQuery);
    } else
      return this.initiateUpdate(
        query === ''
          ? this.filesCache.files
          : this.filesCache.files.filter(file =>
              file.name.toLowerCase().includes(lowerCaseQuery),
            ),
      );
  }, 50);

  resultsShown: number = 0;

  initiateUpdate(files: TFile[]) {
    this.filesInSearch = files;
    this.selectionCommandBar.updateSelectionItems();
    this.resultsShown = 0;
    return this.nextBatch(10);
  }

  nextBatch(number: number) {
    const toNumber = Math.min(
      this.resultsShown + number,
      this.filesInSearch.length,
    );
    const fromNumber = this.resultsShown;
    this.resultsShown = toNumber;
    return Promise.all(
      this.filesInSearch
        .slice(fromNumber, toNumber)
        .map(file => this.resultsCtr.addResult(file)),
    );
  }

  SCROLL_LOAD_THRESHOLD: number = 4096;

  checkScroll() {
    const { scrollTop, scrollHeight, clientHeight } = this.resultsCtr.resultsEl;

    if (scrollTop + clientHeight >= scrollHeight - this.SCROLL_LOAD_THRESHOLD) {
      if (this.resultsShown < this.filesInSearch.length) {
        return this.nextBatch(10);
      }
    }
    return Promise.resolve();
  }

  showFolders(lowerCaseQuery: string) {
    this.filesInSearch = [];
    this.mode = 'folders';
    this.filesCache.folders
      .filter(folder => folder.path.toLowerCase().includes(lowerCaseQuery))
      .forEach(folder => {
        const card = this.resultsCtr.resultsEl.createDiv(
          'mobile-search-result-card',
        );
        card.createDiv({
          cls: 'mobile-search-result-filename',
          text: folder.path,
        });
        card.addEventListener('click', () => {
          this.filesCache.folder = folder;
          this.mode = 'files';
          void this.update();
          this.searchInput.setValue('');
          this.searchInput.focus();
        });
      });
  }

  /**
   * Sets up an IntersectionObserver to detect when the view becomes visible
   * (e.g., when the mobile sidebar drawer is swiped open).
   */
  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            this.searchInput.focus();
          }
        }
      },
      {
        threshold: [0, 0.5, 1],
      },
    );

    this.intersectionObserver.observe(this.contentEl);
  }
}

/**
 * Command bar for managing file selection operations in the mobile search view.
 *
 * Provides a toolbar with actions for selected files including:
 * - Select all/deselect all toggle
 * - Selection count display
 * - Batch operations menu (open, delete, etc.)
 * - Individual file context menus
 *
 * @extends Component
 */
class SelectionCommandBar extends Component {
  private selectionCommandBar: HTMLDivElement;
  selectAllButton: ButtonComponent;
  countLabel: HTMLSpanElement;
  private selectedFiles: Set<TFile> = new Set();
  selectionMenuButton: ExtraButtonComponent;
  get selected(): boolean {
    return this.selectedFiles.size > 0;
  }

  constructor(
    public leaf: SearchLeaf,
    parent: HTMLElement,
  ) {
    super();
    this.selectionCommandBar = parent.createDiv({
      cls: 'mobile-search-selection-bar',
    });
    this.setupSelectionCommandBar();
  }

  toggleSelectionCommandBar(toggle?: boolean): void {
    this.selectionCommandBar.classList.toggle('show', toggle);
    this.leaf.searchContainer.classList.toggle('hide', toggle);
  }

  updateSelectionItems(): void {
    this.selectedFiles.forEach(
      file =>
        !this.leaf.filesInSearch.includes(file) &&
        this.selectedFiles.delete(file),
    );
    this.leaf.resultsCtr.updateSelectionItems();
    this.update();
  }

  toggleSelection(
    file: TFile,
    selected: boolean = !this.selectedFiles.has(file),
  ): void {
    void (selected
      ? this.selectedFiles.add(file)
      : this.selectedFiles.delete(file));
    this.updateSelectionItems();
  }

  selectAll(): void {
    this.selectedFiles = new Set(this.leaf.filesInSearch);
    this.updateSelectionItems();
  }

  isSelected(file: TFile): boolean {
    return this.selectedFiles.has(file);
  }

  update() {
    this.toggleSelectionCommandBar(this.selectedFiles.size > 0);
    this.selectAllButton.buttonEl.classList.toggle(
      'hide',
      this.selectedFiles.size === this.leaf.filesInSearch.length,
    );
    this.countLabel.textContent = `${this.selectedFiles.size} selected`;
  }

  /**
   * Sets up the selection command bar with action buttons.
   */
  private setupSelectionCommandBar(): void {
    if (!this.selectionCommandBar) return;

    this.selectionCommandBar.empty();

    // Cancel button
    new ExtraButtonComponent(this.selectionCommandBar)
      .setIcon('cross')
      .onClick(() => {
        this.selectedFiles.clear();
        this.updateSelectionItems();
      });

    // Select all/deselect all button
    this.selectAllButton = new ButtonComponent(this.selectionCommandBar)
      .setButtonText('Select all')
      .onClick(() => this.selectAll());

    // Selection count
    this.countLabel = this.selectionCommandBar.createSpan({
      cls: 'mobile-search-selection-count',
      text: '0 selected',
    });

    // Three-dot menu button
    this.selectionMenuButton = new ExtraButtonComponent(
      this.selectionCommandBar,
    )
      .setIcon('ellipsis-vertical')
      .setTooltip('More actions')
      .onClick(() => this.openMenuForSelection());
  }

  openMenu(file: TFile, event?: MouseEvent) {
    if (this.isSelected(file) && this.selectedFiles.size > 1) {
      this.showSelectionMenu(event);
      return;
    }
    this.showFileContextMenu(file, event);
  }

  openMenuForSelection(event?: MouseEvent) {
    if (this.selectedFiles.size === 0) return;
    if (this.selectedFiles.size === 1) {
      const [file] = this.selectedFiles;
      this.openMenu(file, event);
      return;
    }
    this.showSelectionMenu(event);
  }

  showSelectionMenu(event?: MouseEvent) {
    if (this.selectedFiles.size === 0) return;

    const menu = new Menu();
    menu
      .addItem(item =>
        item
          .setTitle(`Open ${this.selectedFiles.size} files`)
          .setIcon('folder-opened')
          .setSection('open')
          .onClick(() => {
            for (const file of this.selectedFiles) {
              void this.leaf.app.workspace.openLinkText(file.path, '', true);
            }
          }),
      )
      .addItem(item =>
        item
          .setTitle(`Delete ${this.selectedFiles.size} files`)
          .setIcon('trash')
          .setSection('danger')
          .setWarning(true)
          .onClick(() => {
            new ConfirmModal(
              this.leaf.app,
              `Are you sure you want to delete ${this.selectedFiles.size} files? This action cannot be undone.`,
            )
              .onConfirm(() => {
                for (const file of this.selectedFiles) {
                  void this.leaf.app.fileManager.trashFile(file);
                }
              })
              .open();
          }),
      );

    // Trigger files-menu event so other plugins can add their items
    this.leaf.app.workspace.trigger(
      'files-menu',
      menu,
      this.selectedFiles,
      'mobile-search-view',
      this.leaf,
    );

    if (event) {
      menu.showAtMouseEvent(event);
    } else {
      const boundaries =
        this.selectionMenuButton.extraSettingsEl.getBoundingClientRect();

      menu.showAtPosition({
        x: boundaries.right,
        y: boundaries.bottom,
      });
    }
  }

  /**
   * Shows a context menu for the given file.
   */
  private showFileContextMenu(file: TFile, event?: MouseEvent): void {
    const menu = new Menu();
    menu
      .addItem(item =>
        item
          .setTitle('Open in new tab')
          .setIcon('file-plus')
          .setSection('open')
          .onClick(() => {
            void this.leaf.app.workspace.openLinkText(file.path, '', 'tab');
          }),
      )
      .addItem(item =>
        item
          .setTitle('Open to the right')
          .setSection('open')
          .setIcon('separator-vertical')
          .onClick(() => {
            void this.leaf.app.workspace.openLinkText(file.path, '', 'split');
          }),
      )
      .addSeparator()
      .addItem(item =>
        item
          .setTitle('Make a copy')
          .setIcon('documents')
          .setSection('action')
          .onClick(async () => {
            let newPath = file.path;
            const parentPath = file.parent?.path || '';
            for (
              let i = 1;
              this.leaf.app.vault.getAbstractFileByPath(newPath);
              i++
            ) {
              newPath = `${parentPath}/${file.basename} ${i}.${file.extension}`;
            }
            await this.leaf.app.vault.copy(file, newPath);
          }),
      );

    this.leaf.app.workspace.trigger(
      'file-menu',
      menu,
      file,
      'mobile-search-view',
      this.leaf,
    );

    menu
      .addItem(item =>
        item
          .setTitle('Rename')
          .setIcon('pencil')
          .setSection('danger')
          .onClick(
            () => void this.leaf.app.fileManager.promptForFileRename?.(file),
          ),
      )
      .addItem(item =>
        item
          .setTitle('Delete')
          .setIcon('trash')
          .setSection('danger')
          .setWarning(true)
          .onClick(() => void this.leaf.app.fileManager.trashFile(file)),
      );

    if (event) {
      menu.showAtMouseEvent(event);
    } else {
      const boundaries =
        this.selectionMenuButton.extraSettingsEl.getBoundingClientRect();

      menu.showAtPosition({
        x: boundaries.right,
        y: boundaries.bottom,
      });
    }
  }
}

/**
 * Manages file and folder caching for the mobile search view.
 *
 * Maintains an up-to-date list of files and folders in the vault,
 * sorted by modification time, with cached file previews for performance.
 * Automatically updates when vault changes occur (create, delete, rename, modify).
 *
 * @extends Component
 */
class FilesCache extends Component {
  private _folder: TFolder | null = null;
  public get folder(): TFolder | null {
    return this._folder;
  }
  public set folder(value: TFolder | null) {
    this._folder = value;
    this.updateFileList();
  }
  private _files: TFile[];
  private _folders: TFolder[];
  private _previewCache: Map<TFile, string>;
  private updateCallback: () => void = () => {};

  constructor(public leaf: SearchLeaf) {
    super();
    this._files = [];
    this._folders = [];
    this._previewCache = new Map();
  }

  onload(): void {
    this.registerEvent(
      this.leaf.app.vault.on('rename', () => this.updateFileList()),
    );
    this.registerEvent(
      this.leaf.app.vault.on('delete', () => this.updateFileList()),
    );
    this.registerEvent(
      this.leaf.app.vault.on('create', () => this.updateFileList()),
    );
    this.registerEvent(
      this.leaf.app.vault.on('modify', () => this.updateFileList()),
    );
    this.updateFileList();
  }

  updateFileList(): void {
    this._files = this.leaf.app.vault
      .getFiles()
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .filter(file => this.hasParent(file, this.folder));
    this._folders = this.leaf.app.vault
      .getAllFolders()
      .sort((a, b) => a.path.localeCompare(b.path));
    this._previewCache.clear();
    this.updateCallback();
  }

  hasParent(file: TAbstractFile, folder: TFolder | null): boolean {
    if (!folder) return true;
    if (file.parent) {
      return file.parent === folder || this.hasParent(file.parent, folder);
    }
    return false;
  }

  async getFilePreview(file: TFile): Promise<string> {
    const cached = this._previewCache.get(file);

    if (cached !== undefined) {
      return cached;
    }

    //if it's not a markdown file, return type
    if (file.extension !== 'md') {
      this._previewCache.set(file, `Type: ${file.extension}`);
      return `Type: ${file.extension}`;
    }

    try {
      const content = await this.leaf.app.vault.cachedRead(file);
      const frontmatterEndPosition =
        this.leaf.app.metadataCache.getFileCache(file)?.frontmatterPosition?.end
          .offset || 0;

      const previewText = content.slice(
        frontmatterEndPosition,
        PREVIEW_LENGTH + frontmatterEndPosition,
      );
      this._previewCache.set(file, previewText);
      return previewText;
    } catch {
      return '';
    }
  }

  onUpdate(callback: () => void): this {
    this.updateCallback = callback;
    return this;
  }

  get files(): TFile[] {
    return this._files;
  }

  get folders(): TFolder[] {
    return this._folders;
  }

  get previewCache(): Map<TFile, string> {
    return this._previewCache;
  }

  onClose(): void {
    this._files = [];
    this._folders = [];
    this._previewCache.clear();
  }
}

/**
 * Enhanced search input component with focus/blur event handling.
 *
 * Wraps the Obsidian SearchComponent with additional functionality
 * for managing search state and responding to focus changes.
 *
 * @extends SearchComponent
 */
class SearchBar extends SearchComponent {
  public folder: TFolder;
  public query: string;
  private onBlurCallback: () => void = () => {};
  private onFocusCallback: () => void = () => {};

  constructor(containerEl: HTMLElement) {
    super(containerEl);

    this.inputEl.addEventListener('blur', () => this.onBlurCallback());
    this.inputEl.addEventListener('focus', () => this.onFocusCallback());
  }

  blur(): void {
    this.inputEl.blur();
  }

  focus(): void {
    this.inputEl.focus();
  }

  onBlur(callback: () => void): this {
    this.onBlurCallback = callback;
    return this;
  }

  onFocus(callback: () => void): this {
    this.onFocusCallback = callback;
    return this;
  }
}

/**
 * Container component for managing search result items.
 *
 * Handles rendering and lifecycle of file result items,
 * with support for infinite scrolling and touch interactions.
 * Manages selection state updates across all result items.
 *
 * @extends Component
 */
class ResultsCtr extends Component {
  resultsEl: HTMLElement;
  private onTouchMoveCallback: () => void = () => {};
  private onScrollCallback: () => void = () => {};
  private onBackAtTopCallback: () => void = () => {};
  backAtToptimedout: NodeJS.Timeout | null = null;
  results: ResultItem[] = [];
  tabsEl: HTMLElement;

  constructor(
    public leaf: SearchLeaf,
    public containerEl: HTMLElement,
    public filesCache: FilesCache,
  ) {
    super();
    this.resultsEl = this.containerEl.createDiv(
      'mobile-search-results-container',
    );
    this.resultsEl.addEventListener(
      'touchmove',
      () => (this.onTouchMoveCallback(), backAtTopThrottler()),
    );

    const backAtTopThrottler = apocalypseThrottle(() => {
      if (this.resultsEl.scrollTop > 100) {
        if (this.backAtToptimedout) {
          clearTimeout(this.backAtToptimedout);
          this.backAtToptimedout = null;
        }
        this.backAtToptimedout = setTimeout(() => {
          if (this.resultsEl.scrollTop === 0) {
            this.onBackAtTopCallback();
            this.backAtToptimedout = null;
          }
        }, 300);
      }
    }, 300);

    this.resultsEl.addEventListener('scroll', () => this.onScrollCallback());
  }

  onload(): void {
    this.tabsEl = this.resultsEl.createDiv({});
    if (this.leaf.plugin.settings.showTabsInSearchView)
      this.showTabsInSearchView(this.leaf.searchInput.getValue());
  }

  ud = () => {
    this.showTabResults(this.leaf.searchInput.getValue());
  };

  showTabsInSearchView(query: string = ''): void {
    this.registerEvent(this.leaf.app.workspace.on('layout-change', this.ud));
    this.registerEvent(
      this.leaf.app.workspace.on('active-leaf-change', this.ud),
    );
    this.showTabResults(query);
  }

  private showTabResults(query: string) {
    this.tabsEl.empty();
    const activeLeaf = this.leaf.app.workspace.getMostRecentLeaf();

    // Create a container for the stack to center it properly
    const stackContainer = this.tabsEl.createDiv({
      cls: 'swipe-past-stack-container',
    });

    this.leaf.app.workspace.iterateRootLeaves(leaf => {
      const div = stackContainer.createDiv('swipe-past-option');
      if (leaf === activeLeaf) div.addClass('is-active');

      new ExtraButtonComponent(div).setIcon(leaf.getIcon());
      div.createSpan({ text: leaf.getDisplayText() });
      new ExtraButtonComponent(div)
        .setIcon('cross')
        .onClick(() => leaf.detach());

      div.onclick = async () => {
        this.leaf.app.workspace.setActiveLeaf(leaf, { focus: true });
        await this.leaf.app.workspace.revealLeaf(leaf);
      };
    });
  }

  updateSelectionItems(): void {
    this.results.forEach(result => result.toggleSelection());
  }

  onTouchMove(callback: () => void): this {
    this.onTouchMoveCallback = callback;
    return this;
  }

  onScroll(callback: () => void): this {
    this.onScrollCallback = callback;
    return this;
  }

  onBackAtTop(callback: () => void): this {
    this.onBackAtTopCallback = callback;
    return this;
  }

  addResult(file: TFile): Promise<void> {
    const resultItem = new ResultItem(this.leaf, this, file);
    this.addChild(resultItem);
    this.results.push(resultItem);
    return resultItem.renderPreview();
  }

  onunload(): void {
    this.results.forEach(result => result.onunload());
    this.results = [];
    this.resultsEl.empty();
  }
}

/**
 * Individual search result item component.
 *
 * Represents a single file in the search results with:
 * - File name and path display
 * - Markdown preview rendering
 * - Last modified date
 * - Selection state management
 * - Click and context menu handlers
 *
 * @extends Component
 */
class ResultItem extends Component {
  private resultEl: HTMLElement;
  private previewWrapper: HTMLDivElement;
  private previewEl: HTMLDivElement;

  constructor(
    public leaf: SearchLeaf,
    public container: ResultsCtr,
    public file: TFile,
  ) {
    super();
    this.resultEl = this.container.resultsEl.createDiv(
      'mobile-search-result-card',
    );

    this.resultEl.toggleClass(
      'selected',
      this.leaf.selectionCommandBar.isSelected(file),
    );

    this.resultEl.addEventListener('click', () => {
      if (this.leaf.selectionCommandBar.selected) {
        this.leaf.selectionCommandBar.toggleSelection(file);
      } else {
        void this.leaf.app.workspace.openLinkText(file.path, '', false);
      }
    });

    this.resultEl.addEventListener('contextmenu', event => {
      event.preventDefault();
      if (this.leaf.selectionCommandBar.selected) {
        this.leaf.selectionCommandBar.openMenu(file, event);
      } else this.leaf.selectionCommandBar.toggleSelection(file);
    });

    this.resultEl.createDiv({
      cls: 'mobile-search-result-filename',
      text: file.basename,
    });

    // File path (subdued)
    if (file.parent && file.parent.path !== '/') {
      this.resultEl.createDiv({
        cls: 'mobile-search-result-path',
        text: file.parent.path,
      });
    }

    // Preview wrapper (for positioning the date)
    this.previewWrapper = this.resultEl.createDiv({
      cls: 'mobile-search-result-preview-wrapper',
    });

    // Preview container
    this.previewEl = this.previewWrapper.createDiv({
      cls: 'mobile-search-result-preview',
    });

    this.previewWrapper.createDiv({
      cls: 'mobile-search-result-date',
      text: this.formatDate(file.stat.mtime),
    });
  }

  toggleSelection(): void {
    this.resultEl.toggleClass(
      'selected',
      this.leaf.selectionCommandBar.isSelected(this.file),
    );
  }

  async renderPreview(): Promise<void> {
    const previewText = await this.container.filesCache.getFilePreview(
      this.file,
    );

    if (previewText) {
      await MarkdownRenderer.render(
        this.leaf.app,
        previewText,
        this.previewEl,
        this.file.path,
        this,
      );
    } else {
      this.previewEl.textContent = 'File is empty';
    }
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // For recent dates, show relative time
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    }

    // For older dates, show the actual date
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Simple confirmation dialog modal.
 *
 * Displays a message with Cancel and Delete buttons,
 * executing a callback when deletion is confirmed.
 *
 * @extends Modal
 */
class ConfirmModal extends Modal {
  onConfirmCallback: () => void;

  constructor(
    app: App,
    public message: string,
  ) {
    super(app);
  }

  onConfirm(callback: () => void): this {
    this.onConfirmCallback = callback;
    return this;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl)
      .setName('Confirm deletion')
      .setDesc(this.message)
      .addButton(btn => btn.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(btn =>
        btn
          .setButtonText('Delete')
          .setWarning()
          .onClick(() => {
            this.onConfirmCallback();
            this.close();
          }),
      );
  }
}
