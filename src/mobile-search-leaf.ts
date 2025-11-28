import {
  Component,
  ItemView,
  MarkdownRenderer,
  Menu,
  SearchComponent,
  TFile,
  WorkspaceLeaf,
} from 'obsidian';
import { throttleWithInterval } from './throttleWithInterval';

export const VIEW_TYPE_MOBILE_SEARCH = 'mobile-search-view';

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

  /** Timestamp of the last search input focus */
  private lastFocusTime = 0;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_MOBILE_SEARCH;
  }

  getDisplayText(): string {
    return 'Mobile Search';
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

    // Create scrollable results container
    this.resultsContainer = container.createDiv({
      cls: 'mobile-search-results-container',
    });

    // Set up event listeners
    this.setupEventListeners();

    // Set up IntersectionObserver for smart focus
    this.setupIntersectionObserver();

    // Show initial results (all files) when pane opens
    await this.performSearch();
  }

  async onClose(): Promise<void> {
    this.cleanupResultComponents();
    this.cleanupObserver();
    this.debouncedSearch.cancel();
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
            this.focusSearchInput();
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
   */
  private async performSearch(): Promise<void> {
    const query = this.searchInput.inputEl.value.trim().toLowerCase();

    // Clear previous results
    this.resultsContainer.empty();
    this.cleanupResultComponents();
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
      this.renderNextBatch();
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

    // Click handler to open the file
    card.addEventListener('click', () => {
      void this.app.workspace.openLinkText(file.path, '', false);
    });

    // Context menu handler (right-click / long-press)
    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.showFileContextMenu(file, event);
    });
  }

  /**
   * Shows a context menu for the given file.
   */
  private showFileContextMenu(file: TFile, event: MouseEvent): void {
    new Menu()
      .addItem((item) =>
        item
          .setTitle('Open in new tab')
          .setIcon('file-plus')
          .onClick(() => {
            void this.app.workspace.openLinkText(file.path, '', 'tab');
          }),
      )
      .addItem((item) =>
        item
          .setTitle('Open to the right')
          .setIcon('separator-vertical')
          .onClick(() => {
            void this.app.workspace.openLinkText(file.path, '', 'split');
          }),
      )
      .addItem((item) =>
        item
          .setTitle('Make a copy')
          .setIcon('documents')
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
      )
      .addSeparator()
      /* .addItem((item) =>
        item
          .setTitle('Rename')
          .setIcon('pencil')
          .onClick(() => {

            // @ts-ignore
            this.app.fileManager.promptForFileRename?.(file);
          }),
      ) */
      .addItem((item) =>
        item
          .setTitle('Delete')
          .setIcon('trash')
          .setWarning(true)
          .onClick(() => {
            void this.app.fileManager.trashFile(file);
          }),
      )
      .addSeparator()
      .addItem((item) =>
        item
          .setTitle('Copy file path')
          .setIcon('link')
          .onClick(() => {
            void navigator.clipboard.writeText(file.path);
          }),
      )
      .addItem((item) =>
        item
          .setTitle('Copy Obsidian URL')
          .setIcon('link')
          .onClick(() => {
            const url = `obsidian://open?vault=${encodeURIComponent(
              this.app.vault.getName(),
            )}&file=${encodeURIComponent(file.path)}`;
            void navigator.clipboard.writeText(url);
          }),
      )
      .showAtMouseEvent(event);
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
