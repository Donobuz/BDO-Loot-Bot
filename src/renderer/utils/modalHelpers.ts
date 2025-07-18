import { ReactNode } from 'react';
import { ModalData, ConfirmationModalData, FormModalData, StatusModalData } from '../contexts/ModalContext';

// Helper function to generate unique modal IDs
let modalIdCounter = 0;
const generateModalId = () => `modal-${++modalIdCounter}`;

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  isDestructive?: boolean;
}

export interface FormModalOptions {
  title: string;
  content: ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export interface StatusModalOptions {
  title: string;
  content: ReactNode;
  closable?: boolean;
}

export const createConfirmationModal = (
  options: ConfirmationOptions,
  onClose: () => void
): ConfirmationModalData => ({
  id: generateModalId(),
  type: 'confirmation',
  title: options.title,
  message: options.message,
  confirmText: options.confirmText,
  cancelText: options.cancelText,
  onConfirm: options.onConfirm,
  isDestructive: options.isDestructive,
  onClose
});

export const createFormModal = (
  options: FormModalOptions,
  onClose: () => void,
  id?: string
): FormModalData => ({
  id: id || generateModalId(),
  type: 'form',
  title: options.title,
  content: options.content,
  size: options.size,
  onClose
});

export const createStatusModal = (
  options: StatusModalOptions,
  onClose: () => void,
  id?: string
): StatusModalData => ({
  id: id || generateModalId(),
  type: 'status',
  title: options.title,
  content: options.content,
  closable: options.closable,
  onClose
});

// Convenience hooks for common modal patterns
export const useConfirmation = (showModal: (modal: ModalData) => void, hideModal: (id: string) => void) => {
  return (options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      const modalId = generateModalId();
      const modal: ConfirmationModalData = {
        id: modalId,
        type: 'confirmation',
        title: options.title,
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        isDestructive: options.isDestructive,
        onConfirm: () => {
          hideModal(modalId);
          resolve(true);
          options.onConfirm();
        },
        onClose: () => {
          hideModal(modalId);
          resolve(false);
        }
      };
      showModal(modal);
    });
  };
};

export const useFormModal = (showModal: (modal: ModalData) => void, hideModal: (id: string) => void) => {
  return (options: FormModalOptions) => {
    const modalId = generateModalId();
    const modal: FormModalData = {
      id: modalId,
      type: 'form',
      title: options.title,
      content: options.content,
      size: options.size,
      onClose: () => hideModal(modalId)
    };
    showModal(modal);
    return modal.id;
  };
};

export const useStatusModal = (showModal: (modal: ModalData) => void, hideModal: (id: string) => void) => {
  return (options: StatusModalOptions) => {
    const modalId = generateModalId();
    const modal: StatusModalData = {
      id: modalId,
      type: 'status',
      title: options.title,
      content: options.content,
      closable: options.closable,
      onClose: () => hideModal(modalId)
    };
    showModal(modal);
    return modal.id;
  };
};
