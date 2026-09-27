export class LoadingOverlay {
  private readonly root: HTMLDivElement

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'loading'
    this.root.textContent = 'Đang tải…'
    parent.appendChild(this.root)
  }

  fail(): void {
    this.root.textContent = 'Không tải được tài nguyên — tải lại trang'
  }

  dispose(): void {
    this.root.remove()
  }
}
