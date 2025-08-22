import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface BaseModalProps {
  id: string;
  title: string;
  onClose: () => void;
}

export interface ConfirmationModalData extends BaseModalProps {
  type: 'confirmation';
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  isDestructive?: boolean;
}

export interface FormModalData extends BaseModalProps {
  type: 'form';
  content: ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export interface StatusModalData extends BaseModalProps {
  type: 'status';
  content: ReactNode;
  closable?: boolean;
}

export type ModalData = ConfirmationModalData | FormModalData | StatusModalData;

interface ModalContextType {
  modals: ModalData[];
  showModal: (modalData: ModalData) => void;
  hideModal: (id: string) => void;
  hideAllModals: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [modals, setModals] = useState<ModalData[]>([]);

  const showModal = (modalData: ModalData) => {
    setModals(prev => [...prev, modalData]);
  };

  const hideModal = (id: string) => {
    setModals(prev => prev.filter(modal => modal.id !== id));
  };

  const hideAllModals = () => {
    setModals([]);
  };

  return (
    <ModalContext.Provider value={{ modals, showModal, hideModal, hideAllModals }}>
      {children}
    </ModalContext.Provider>
  );
};
