import React, { useEffect } from 'react';
import { ModalData, ConfirmationModalData, FormModalData, StatusModalData } from '../../contexts/ModalContext';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string; // Custom width override
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, width }) => {
  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      // Prevent body scrolling
      document.body.style.overflow = 'hidden';
    } else {
      // Restore body scrolling
      document.body.style.overflow = '';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div 
        className="modal-container" 
        style={width ? { width, maxWidth: '90vw' } : undefined}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

// Legacy modal components for backward compatibility
interface ConfirmationModalProps {
  data: ConfirmationModalData;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ data }) => {
  const { title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onClose, isDestructive = false } = data;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ color: '#cdd6f4', marginBottom: '24px' }}>{message}</p>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {cancelText}
            </button>
            <button 
              type="button" 
              className={`${isDestructive ? 'btn-secondary' : 'btn-primary'}`} 
              onClick={onConfirm}
              style={isDestructive ? { background: 'linear-gradient(145deg, #f38ba8, #e74c3c)' } : {}}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FormModalProps {
  data: FormModalData;
}

const FormModal: React.FC<FormModalProps> = ({ data }) => {
  const { title, content, onClose } = data;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {content}
        </div>
      </div>
    </div>
  );
};

interface StatusModalProps {
  data: StatusModalData;
}

const StatusModal: React.FC<StatusModalProps> = ({ data }) => {
  const { title, content, onClose, closable = true } = data;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closable && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container">
        <div className="modal-header">
          <h3>{title}</h3>
          {closable && (
            <button className="modal-close" onClick={onClose}>×</button>
          )}
        </div>
        <div className="modal-body">
          {content}
        </div>
      </div>
    </div>
  );
};

interface ModalRendererProps {
  modals: ModalData[];
}

export const ModalRenderer: React.FC<ModalRendererProps> = ({ modals }) => {
  if (modals.length === 0) return null;

  return (
    <>
      {modals.map((modal) => {
        switch (modal.type) {
          case 'confirmation':
            return <ConfirmationModal key={modal.id} data={modal} />;
          case 'form':
            return <FormModal key={modal.id} data={modal} />;
          case 'status':
            return <StatusModal key={modal.id} data={modal} />;
          default:
            return null;
        }
      })}
    </>
  );
};

export default Modal;
