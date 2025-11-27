import {
  Component,
  ItemView,
  MarkdownRenderer,
  TFile,
  WorkspaceLeaf,
} from 'obsidian';
import { throttleWithInterval } from './throttleWithInterval';

export const VIEW_TYPE_MOBILE_SEARCH = 'mobile-search-view';

/**
 * A mobile-optimized search view that provides a sticky search input
 * with scrollable results and smart keyboard handling.
 */
export class MobileSearchLeaf extends ItemView {
  private searchInput: HTMLInputElement;
  private resultsContainer: HTMLDivElement;
  private intersectionObserver: IntersectionObserver | null = null;
  private resultComponents: Component[] = [];

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

    // Create sticky search input container
    const searchContainer = container.createDiv({
      cls: 'mobile-search-input-container',
    });
    this.searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: 'Search files...',
      cls: 'mobile-search-input',
    });

    // Create scrollable results container
    this.resultsContainer = container.createDiv({
      cls: 'mobile-search-results-container',
    });

    // Set up event listeners
    this.setupEventListeners();

    // Set up IntersectionObserver for smart focus
    this.setupIntersectionObserver();
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
    // Debounced search on input
    this.searchInput.addEventListener('input', () => this.debouncedSearch());

    // Keyboard handling: blur input on scroll to dismiss keyboard
    this.resultsContainer.addEventListener('scroll', () => {
      this.searchInput.blur();
    });

    // Allow pressing Enter to trigger immediate search
    this.searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
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
      this.searchInput.focus();
    });
  }

  /**
   * Debounces the search to avoid re-rendering on every keystroke.
   * Uses a 300ms delay.
   */
  private debouncedSearch = throttleWithInterval(
    () => void this.performSearch(),
    300,
  );

  /**
   * Performs the search and renders results.
   */
  private async performSearch(): Promise<void> {
    const query = this.searchInput.value.trim().toLowerCase();

    // Clear previous results
    this.resultsContainer.empty();
    this.cleanupResultComponents();

    if (!query) {
      return;
    }

    // Get all markdown files
    const files = this.app.vault
      .getMarkdownFiles()
      .sort((a, b) => b.stat.mtime - a.stat.mtime);

    // Filter files by query (match filename or path)
    const matchingFiles = files.filter((file) => {
      const filename = file.basename.toLowerCase();
      const path = file.path.toLowerCase();
      return filename.includes(query) || path.includes(query);
    });

    // Limit results for performance
    const maxResults = 50;
    const limitedFiles = matchingFiles.slice(0, maxResults);

    // Render all result cards in parallel for better performance
    // Use Promise.allSettled so individual failures don't block other renders
    await Promise.allSettled(
      limitedFiles.map((file) => this.renderResultCard(file)),
    );

    // Show message if no results
    if (limitedFiles.length === 0) {
      this.resultsContainer.createDiv({
        cls: 'mobile-search-no-results',
        text: 'No files found',
      });
    } else if (matchingFiles.length > maxResults) {
      this.resultsContainer.createDiv({
        cls: 'mobile-search-more-results',
        text: `Showing ${maxResults} of ${matchingFiles.length} results`,
      });
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

    // Preview container
    const previewEl = card.createDiv({
      cls: 'mobile-search-result-preview',
    });

    // Read file content and render preview
    try {
      const content = await this.app.vault.cachedRead(file);
      const previewText = content.slice(0, 200);

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
    } catch {
      previewEl.setText('Unable to load preview');
    }

    // Click handler to open the file
    card.addEventListener('click', () => {
      void this.app.workspace.openLinkText(file.path, '', false);
    });
  }
}
