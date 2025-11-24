/**
 * Confirmation modal for destructive operations
 */

import { App, Modal } from 'obsidian';

export class ConfirmModal extends Modal {
	private title: string;
	private message: string;
	private onConfirm: (confirmed: boolean) => void;

	constructor(
		app: App,
		title: string,
		message: string,
		onConfirm: (confirmed: boolean) => void
	) {
		super(app);
		this.title = title;
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: this.title });

		const messageEl = contentEl.createEl('p', {
			cls: 'setting-item-description'
		});

		// Split message by newlines and create separate paragraphs
		const lines = this.message.split('\n');
		lines.forEach(line => {
			if (line.trim()) {
				messageEl.createEl('div', { text: line });
			} else {
				messageEl.createEl('br');
			}
		});

		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonContainer.style.marginTop = '20px';
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '10px';

		// Cancel button
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.onConfirm(false);
			this.close();
		});

		// Confirm button (destructive style)
		const confirmButton = buttonContainer.createEl('button', {
			text: 'Force Push',
			cls: 'mod-warning'
		});
		confirmButton.addEventListener('click', () => {
			this.onConfirm(true);
			this.close();
		});

		// Set cancel as default focus
		cancelButton.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
