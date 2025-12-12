import {
  ButtonComponent,
  Component,
  ExtraButtonComponent,
  ItemView,
  MarkdownRenderer,
  Menu,
  SearchComponent,
  TFile,
  WorkspaceLeaf,
} from 'obsidian';
import { throttleWithInterval } from './throttleWithInterval';

export const VIEW_TYPE_MOBILE_SEARCH = 'mobile-search-view';

// Type for Obsidian's internal FileManager API (not in public API)
interface ObsidianFileManagerAPI {
  promptForFileRename?: (file: TFile) => unknown;
}

/** Number of results to render initially */
const INITIAL_RESULTS_PER_BATCH = 10;

/** Number of results to render per scroll batch after initial load */
const SUBSEQUENT_RESULTS_PER_BATCH = 50;

/** Pixels from bottom of results container to trigger loading more results */
const SCROLL_LOAD_THRESHOLD = 4096;

/** Maximum characters of file content to show in preview */
const PREVIEW_LENGTH = 200;

/**
 * A mobile-optimized search view that provides a sticky search input
 * with scrollable results and smart keyboard handling.
 */
export class MobileSearchLeaf extends ItemView {
  private searchInput: SearchComponent;
  private resultsContainer: HTMLDivElement;
  private intersectionObserver: IntersectionObserver | null = null;
  private resultComponents: Component[] = [];

  /** Cache for file preview content, reset when pane opens or search is focused */
  private previewCache: Map<string, string> = new Map();

  /** Current list of files matching the search query */
  private currentMatchingFiles: TFile[] = [];

  /** Number of results currently rendered */
  private renderedResultsCount = 0;

  /** Flag to prevent multiple concurrent loadMore operations */
  private isLoadingMore = false;

  /** Flag to prevent multiple concurrent performSearch operations */
  private isSearching = false;

  /** Timestamp of the last search input focus */
  private lastFocusTime = 0;

  /** Flag to track if the view is currently visible/focused */
  private isViewActive = false;

  /** Selection mode state */
  private isSelectionMode = false;

  /** Set of selected file paths */
  private selectedFiles: Set<string> = new Set();

  /** Selection command bar container */
  private selectionCommandBar: HTMLDivElement | null = null;

  /** Select all/deselect all button */
  private selectAllButton: ButtonComponent | null = null;

  /** Map of card elements to file paths for quick lookup */
  private cardElementMap: Map<HTMLElement, TFile> = new Map();

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_MOBILE_SEARCH;
  }

  getDisplayText(): string {
    return 'Search';
  }

  getIcon(): string {
    return 'search';
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass('mobile-search-view');

    // Reset preview cache when pane opens
    this.resetCache();

    // Create sticky search input container
    const searchContainer = container.createDiv({
      cls: 'mobile-search-input-container',
    });
    this.searchInput = new SearchComponent(searchContainer).setPlaceholder(
      'Search files...',
    );

    // Create selection command bar (hidden by default)
    this.selectionCommandBar = container.createDiv({
      cls: 'mobile-search-selection-bar',
    });
    this.selectionCommandBar.setCssProps({ display: 'none' });
    this.setupSelectionCommandBar();

    // Create scrollable results container
    this.resultsContainer = container.createDiv({
      cls: 'mobile-search-results-container',
    });

    // Set up event listeners
    this.setupEventListeners();

    // Set up IntersectionObserver for smart focus
    this.setupIntersectionObserver();

    // Set up file change listener
    this.setupFileChangeListener();

    // Show initial results (all files) when pane opens
    await this.performSearch();
  }

  onClose(): Promise<void> {
    this.cleanupResultComponents();
    this.cleanupObserver();
    this.debouncedSearch.cancel();
    return Promise.resolve();
  }

  /**
   * Called when the view is resized. Use this as an additional
   * check to focus the input when the drawer opens on mobile.
   */
  onResize(): void {
    // Check if the view is visible and focus the input
    if (this.isViewVisible()) {
      this.focusSearchInput();
    }
  }

  /**
   * Sets up all event listeners for the search view.
   */
  private setupEventListeners(): void {
    // Scroll to top when search input is focused
    this.searchInput.inputEl.addEventListener('focus', () => {
      this.lastFocusTime = Date.now();
      this.resultsContainer.scrollTop = 0;
      this.isViewActive = true;
    });

    // Track when input loses focus
    this.searchInput.inputEl.addEventListener('blur', () => {
      // Check if view is still visible after a short delay
      setTimeout(() => {
        if (!this.isViewVisible()) {
          this.isViewActive = false;
        }
      }, 100);
    });

    // Debounced search on input
    this.searchInput.inputEl.addEventListener('input', () =>
      this.debouncedSearch(),
    );

    // Keyboard handling: blur input on scroll to dismiss keyboard
    // Also check for infinite scroll loading
    this.resultsContainer.addEventListener('scroll', () => {
      if (Date.now() - this.lastFocusTime > 100) {
        this.searchInput.inputEl.blur();
      }
      this.checkLoadMore();
    });

    // Allow pressing Enter to trigger immediate search
    this.searchInput.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        this.debouncedSearch.cancel();
        void this.performSearch();
      }
    });
  }

  /**
   * Sets up an IntersectionObserver to detect when the view becomes visible
   * (e.g., when the mobile sidebar drawer is swiped open).
   */
  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            // View is now visible, focus the input
            this.isViewActive = true;
            this.focusSearchInput();
          } else if (!entry.isIntersecting) {
            // View is no longer visible
            this.isViewActive = false;
          }
        }
      },
      {
        threshold: [0, 0.5, 1],
      },
    );

    this.intersectionObserver.observe(this.contentEl);
  }

  /**
   * Sets up file change listeners to update the list when files are created, deleted, or renamed.
   * Only updates if the view is currently open/focused.
   */
  private setupFileChangeListener(): void {
    // Listen for file creation
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && this.shouldUpdateOnFileChange()) {
          void this.performSearch();
        }
      }),
    );

    // Listen for file deletion
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && this.shouldUpdateOnFileChange()) {
          void this.performSearch();
        }
      }),
    );

    // Listen for file rename
    this.registerEvent(
      this.app.vault.on('rename', (file) => {
        if (file instanceof TFile && this.shouldUpdateOnFileChange()) {
          void this.performSearch();
        }
      }),
    );

    // Listen for file modification (updates mtime for sorting)
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && this.shouldUpdateOnFileChange()) {
          void this.performSearch();
        }
      }),
    );
  }

  /**
   * Determines if the file list should be updated based on view visibility.
   */
  private shouldUpdateOnFileChange(): boolean {
    return this.isViewActive || this.isViewVisible();
  }

  /**
   * Cleans up the IntersectionObserver.
   */
  private cleanupObserver(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
  }

  /**
   * Cleans up all result components to prevent memory leaks.
   */
  private cleanupResultComponents(): void {
    for (const component of this.resultComponents) {
      component.unload();
    }
    this.resultComponents = [];
  }

  /**
   * Checks if the view is currently visible.
   */
  private isViewVisible(): boolean {
    const rect = this.contentEl.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Focuses the search input with a slight delay to ensure keyboard pops up.
   */
  private focusSearchInput(): void {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      this.searchInput.inputEl.focus();
      this.resetCache();
      void this.performSearch(); // fix so the it updates when opened
    });
  }

  /**
   * Debounces the search to avoid re-rendering on every keystroke.
   * Uses a 300ms delay.
   */
  private debouncedSearch = throttleWithInterval(
    () => void this.performSearch(),
    100,
  );

  /**
   * Performs the search and renders results.
   * Prevents concurrent executions to avoid race conditions.
   */
  private async performSearch(): Promise<void> {
    // Prevent concurrent search operations
    if (this.isSearching) {
      return;
    }

    this.isSearching = true;

    try {
      const query = this.searchInput.inputEl.value.trim().toLowerCase();

      // Clear previous results
      this.resultsContainer.empty();
      this.cleanupResultComponents();
      this.cardElementMap.clear();
      this.renderedResultsCount = 0;

      // Get all markdown files sorted by modification time
      const files = this.app.vault
        .getMarkdownFiles()
        .sort((a, b) => b.stat.mtime - a.stat.mtime);

      // Filter files by query (match filename or path), or show all if no query
      if (query) {
        this.currentMatchingFiles = files.filter((file) => {
          const filename = file.basename.toLowerCase();
          const path = file.path.toLowerCase();
          return filename.includes(query) || path.includes(query);
        });
      } else {
        // Show all files when no query
        this.currentMatchingFiles = files;
      }

      // Render initial batch of results
      await this.renderNextBatch();

      // Show message if no results
      if (this.currentMatchingFiles.length === 0) {
        this.resultsContainer.createDiv({
          cls: 'mobile-search-no-results',
          text: 'No files found',
        });
      }
    } finally {
      this.isSearching = false;
    }
  }

  /**
   * Renders the next batch of results for infinite scroll.
   */
  private async renderNextBatch(): Promise<void> {
    if (this.isLoadingMore) return;

    const startIndex = this.renderedResultsCount;
    const batchSize =
      startIndex === 0
        ? INITIAL_RESULTS_PER_BATCH
        : SUBSEQUENT_RESULTS_PER_BATCH;
    const endIndex = Math.min(
      startIndex + batchSize,
      this.currentMatchingFiles.length,
    );

    if (startIndex >= this.currentMatchingFiles.length) return;

    this.isLoadingMore = true;

    const filesToRender = this.currentMatchingFiles.slice(startIndex, endIndex);

    // Render result cards in parallel for better performance
    await Promise.allSettled(
      filesToRender.map((file) => this.renderResultCard(file)),
    );

    this.renderedResultsCount = endIndex;
    this.isLoadingMore = false;
  }

  /**
   * Checks if user has scrolled near the bottom and loads more results.
   */
  private checkLoadMore(): void {
    if (this.renderedResultsCount === INITIAL_RESULTS_PER_BATCH) {
      void this.renderNextBatch();
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = this.resultsContainer;

    if (scrollTop + clientHeight >= scrollHeight - SCROLL_LOAD_THRESHOLD) {
      if (this.renderedResultsCount < this.currentMatchingFiles.length) {
        void this.renderNextBatch();
      }
    }
  }

  /**
   * Resets the preview cache.
   */
  private resetCache(): void {
    this.previewCache.clear();
  }

  /**
   * Gets preview content for a file, using cache if available.
   */
  private async getPreviewContent(file: TFile): Promise<string> {
    const cached = this.previewCache.get(file.path);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const content = await this.app.vault.cachedRead(file);
      const frontmatterEndPosition =
        this.app.metadataCache.getFileCache(file)?.frontmatterPosition?.end
          .offset || 0;

      const previewText = content.slice(
        frontmatterEndPosition,
        PREVIEW_LENGTH + frontmatterEndPosition,
      );
      this.previewCache.set(file.path, previewText);
      return previewText;
    } catch {
      return '';
    }
  }

  /**
   * Renders a result card for a file, including filename and preview.
   */
  private async renderResultCard(file: TFile): Promise<void> {
    const card = this.resultsContainer.createDiv({
      cls: 'mobile-search-result-card',
    });

    // Store card-file mapping for selection updates
    this.cardElementMap.set(card, file);

    // Apply selection state if file is already selected
    if (this.selectedFiles.has(file.path)) {
      card.addClass('is-selected');
    }

    // Filename header
    card.createDiv({
      cls: 'mobile-search-result-filename',
      text: file.basename,
    });

    // File path (subdued)
    if (file.parent && file.parent.path !== '/') {
      card.createDiv({
        cls: 'mobile-search-result-path',
        text: file.parent.path,
      });
    }

    // Preview wrapper (for positioning the date)
    const previewWrapper = card.createDiv({
      cls: 'mobile-search-result-preview-wrapper',
    });

    // Preview container
    const previewEl = previewWrapper.createDiv({
      cls: 'mobile-search-result-preview',
    });

    // Get preview content from cache or read file
    const previewText = await this.getPreviewContent(file);

    if (previewText) {
      // Create a component for this render
      const component = new Component();
      component.load();
      this.resultComponents.push(component);

      // Render markdown preview
      await MarkdownRenderer.render(
        this.app,
        previewText,
        previewEl,
        file.path,
        component,
      );
    } else {
      previewEl.setText('Unable to load preview');
    }

    // Date at the bottom corner of the preview
    previewWrapper.createDiv({
      cls: 'mobile-search-result-date',
      text: this.formatDate(file.stat.mtime),
    });

    // Click handler - either toggle selection or open file
    card.addEventListener('click', (event) => {
      if (this.isSelectionMode) {
        event.preventDefault();
        this.toggleFileSelection(file, card);
      } else {
        void this.app.workspace.openLinkText(file.path, '', false);
      }
    });

    // Context menu handler (right-click / long-press)
    // Enters selection mode if not already in it
    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();

      if (!this.isSelectionMode) {
        // Enter selection mode and select this file
        this.enterSelectionMode();
        this.toggleFileSelection(file, card);
      }

      // Show appropriate menu based on selection count
      if (this.selectedFiles.size === 1) {
        // Show single file menu when only one file is selected
        this.showFileContextMenu(file, event);
      } else {
        // Show multiple files menu when multiple files are selected
        this.showMultipleFilesMenu(event);
      }
    });
  }

  /**
   * Shows a context menu for the given file.
   */
  private showFileContextMenu(file: TFile, event?: MouseEvent): void {
    const menu = new Menu();
    menu
      .addItem((item) =>
        item
          .setTitle('Open in new tab')
          .setIcon('file-plus')
          .setSection('open')
          .onClick(() => {
            void this.app.workspace.openLinkText(file.path, '', 'tab');
          }),
      )
      .addItem((item) =>
        item
          .setTitle('Open to the right')
          .setSection('open')
          .setIcon('separator-vertical')
          .onClick(() => {
            void this.app.workspace.openLinkText(file.path, '', 'split');
          }),
      )
      .addSeparator()
      .addItem((item) =>
        item
          .setTitle('Make a copy')
          .setIcon('documents')
          .setSection('action')
          .onClick(async () => {
            let version = 0;
            let newPath = file.path;
            const ext = file.extension;
            const base = file.basename;
            const parent = file.parent ? file.parent.path : '/';
            const parentPath = parent === '/' ? '' : parent + '/';

            while (this.app.vault.getAbstractFileByPath(newPath)) {
              version++;
              newPath = `${parentPath}${base} ${version}.${ext}`;
            }
            await this.app.vault.copy(file, newPath);
          }),
      );
    this.app.workspace.trigger(
      'file-menu',
      menu,
      file,
      'mobile-search-view',
      this.leaf,
    );

    menu
      .addItem((item) =>
        item
          .setTitle('Rename')
          .setIcon('pencil')
          .setSection('danger')
          .onClick(() => {
            (
              this.app.fileManager as unknown as ObsidianFileManagerAPI
            ).promptForFileRename?.(file);
          }),
      )
      .addItem((item) =>
        item
          .setTitle('Delete')
          .setIcon('trash')
          .setSection('danger')
          .setWarning(true)
          .onClick(() => {
            void this.app.fileManager.trashFile(file);
          }),
      );

    if (event) {
      menu.showAtMouseEvent(event);
    } else {
      menu.showAtPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    }
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
      .onClick(() => this.exitSelectionMode());

    // Select all/deselect all button
    this.selectAllButton = new ButtonComponent(this.selectionCommandBar)
      .setButtonText('Select all')
      .onClick(() => this.toggleSelectAll());

    // Selection count
    const countLabel = this.selectionCommandBar.createSpan({
      cls: 'mobile-search-selection-count',
      text: '0 selected',
    });
    countLabel.setAttribute('data-selection-count', '0');

    // Three-dot menu button
    new ExtraButtonComponent(this.selectionCommandBar)
      .setIcon('ellipsis-vertical')
      .setTooltip('More actions')
      .onClick(() => this.showMultipleFilesMenu());
  }

  /**
   * Enters selection mode.
   */
  private enterSelectionMode(): void {
    this.isSelectionMode = true;
    this.selectedFiles.clear();

    // Hide search bar, show selection command bar
    const searchContainer = this.contentEl.querySelector(
      '.mobile-search-input-container',
    ) as HTMLElement;
    if (searchContainer) {
      searchContainer.setCssProps({ display: 'none' });
    }
    if (this.selectionCommandBar) {
      this.selectionCommandBar.setCssProps({ display: 'flex' });
    }

    // Update all cards to show selection state
    this.updateAllCardsSelectionUI();
  }

  /**
   * Exits selection mode.
   */
  private exitSelectionMode(): void {
    this.isSelectionMode = false;
    this.selectedFiles.clear();

    // Show search bar, hide selection command bar
    const searchContainer = this.contentEl.querySelector(
      '.mobile-search-input-container',
    ) as HTMLElement;
    if (searchContainer) {
      searchContainer.setCssProps({ display: 'block' });
    }
    if (this.selectionCommandBar) {
      this.selectionCommandBar.setCssProps({ display: 'none' });
    }

    // Update all cards to remove selection state
    this.updateAllCardsSelectionUI();
  }

  /**
   * Toggles selection of a file.
   */
  private toggleFileSelection(file: TFile, cardElement: HTMLElement): void {
    if (this.selectedFiles.has(file.path)) {
      this.selectedFiles.delete(file.path);
      cardElement.removeClass('is-selected');
    } else {
      this.selectedFiles.add(file.path);
      cardElement.addClass('is-selected');
    }
    this.updateSelectionCount();

    // Exit selection mode if no files are selected
    if (this.selectedFiles.size === 0) {
      this.exitSelectionMode();
    }
  }

  /**
   * Toggles between selecting all files and deselecting all files.
   */
  private toggleSelectAll(): void {
    const allSelected =
      this.selectedFiles.size === this.currentMatchingFiles.length &&
      this.currentMatchingFiles.length > 0;

    if (allSelected) {
      // Deselect all
      this.selectedFiles.clear();
    } else {
      // Select all
      this.selectedFiles.clear();
      for (const file of this.currentMatchingFiles) {
        this.selectedFiles.add(file.path);
      }
    }
    this.updateAllCardsSelectionUI();
    this.updateSelectionCount();
  }

  /**
   * Updates the selection count display and select all button.
   */
  private updateSelectionCount(): void {
    if (!this.selectionCommandBar) return;
    const countLabel = this.selectionCommandBar.querySelector(
      '.mobile-search-selection-count',
    ) as HTMLElement;
    if (countLabel) {
      const count = this.selectedFiles.size;
      countLabel.textContent = `${count} selected`;
    }

    // Update select all button text based on whether all files are selected
    if (this.selectAllButton) {
      const allSelected =
        this.selectedFiles.size === this.currentMatchingFiles.length &&
        this.currentMatchingFiles.length > 0;
      this.selectAllButton.setButtonText(
        allSelected ? 'Deselect all' : 'Select all',
      );
    }
  }

  /**
   * Updates all card elements to reflect current selection state.
   */
  private updateAllCardsSelectionUI(): void {
    this.cardElementMap.forEach((file, cardElement) => {
      if (this.selectedFiles.has(file.path)) {
        cardElement.addClass('is-selected');
      } else {
        cardElement.removeClass('is-selected');
      }
    });
  }

  /**
   * Shows the appropriate menu based on the number of selected files.
   * Called from the three-dot menu button.
   */
  private showSelectionMenu(): void {
    if (this.selectedFiles.size === 0) {
      // Exit selection mode if no files are selected
      this.exitSelectionMode();
      return;
    }

    if (this.selectedFiles.size === 1) {
      // Show single file menu when only one file is selected
      const filePath = Array.from(this.selectedFiles)[0];
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        this.showFileContextMenu(file);
      }
    } else {
      // Show multiple files menu when multiple files are selected
      this.showMultipleFilesMenu();
    }
  }

  /**
   * Shows the multiple files context menu.
   */
  private showMultipleFilesMenu(event?: MouseEvent): void {
    if (this.selectedFiles.size === 0) return;

    const menu = new Menu();
    const selectedFileObjects = Array.from(this.selectedFiles)
      .map((path) => this.app.vault.getAbstractFileByPath(path))
      .filter((f): f is TFile => f instanceof TFile);

    // Trigger files-menu event so other plugins can add their items
    this.app.workspace.trigger(
      'files-menu',
      menu,
      selectedFileObjects,
      'mobile-search-view',
      this.leaf,
    );

    if (event) {
      menu.showAtMouseEvent(event);
    } else {
      // When no event is provided (e.g., from button click), show at center screen position
      menu.showAtPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    }
  }

  /**
   * Formats a timestamp into a human-readable date string.
   */
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
