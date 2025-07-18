# Global Modal System

This project uses a global modal system that provides a consistent and reusable way to display different types of modals throughout the application.

## Components

### ModalProvider
Wrap your app with `ModalProvider` to enable the global modal system:

```tsx
import { ModalProvider } from './contexts/ModalContext';

function App() {
  return (
    <ModalProvider>
      <YourAppContent />
    </ModalProvider>
  );
}
```

### ModalRenderer
Add the `ModalRenderer` component to render active modals:

```tsx
import { useModal } from './contexts/ModalContext';
import { ModalRenderer } from './components/Modal/Modal';

function AppContent() {
  const { modals } = useModal();
  
  return (
    <>
      <YourContent />
      <ModalRenderer modals={modals} />
    </>
  );
}
```

## Modal Types

### 1. Confirmation Modal
Used for yes/no confirmations with optional destructive styling.

```tsx
import { useModal } from '../contexts/ModalContext';
import { useConfirmation } from '../utils/modalHelpers';

function MyComponent() {
  const { showModal, hideModal } = useModal();
  const showConfirmation = useConfirmation(showModal, hideModal);
  
  const handleDelete = async () => {
    const confirmed = await showConfirmation({
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {}, // Required but handled by promise resolution
      isDestructive: true
    });
    
    if (confirmed) {
      // User confirmed, proceed with deletion
      deleteItem();
    }
  };
}
```

### 2. Form Modal
Used for displaying forms or complex content.

```tsx
import { useModal } from '../contexts/ModalContext';
import { useFormModal } from '../utils/modalHelpers';

function MyComponent() {
  const { showModal, hideModal } = useModal();
  const showFormModal = useFormModal(showModal, hideModal);
  
  const handleOpenForm = () => {
    const formContent = (
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Enter name..." />
        <button type="submit">Save</button>
      </form>
    );
    
    showFormModal({
      title: 'Add New Item',
      content: formContent,
      size: 'medium' // 'small', 'medium', or 'large'
    });
  };
}
```

### 3. Status Modal
Used for displaying progress, status updates, or non-interactive content.

```tsx
import { useModal } from '../contexts/ModalContext';
import { useStatusModal } from '../utils/modalHelpers';

function MyComponent() {
  const { showModal, hideModal } = useModal();
  const showStatusModal = useStatusModal(showModal, hideModal);
  
  const handleShowProgress = () => {
    const statusContent = (
      <div>
        <p>Processing items...</p>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: '45%' }}></div>
        </div>
        <p>45% complete</p>
      </div>
    );
    
    const modalId = showStatusModal({
      title: 'Processing',
      content: statusContent,
      closable: false // Prevent user from closing manually
    });
    
    // Later, when processing is complete:
    // hideModal(modalId);
  };
}
```

## Hook API

### useModal()
Returns the modal context with these methods:
- `showModal(modalData)` - Show a modal
- `hideModal(id)` - Hide a specific modal by ID
- `hideAllModals()` - Hide all modals
- `modals` - Array of currently active modals

### Helper Hooks
These hooks provide convenient ways to show specific modal types:

- `useConfirmation(showModal, hideModal)` - Returns a function that shows confirmation modals and returns a Promise<boolean>
- `useFormModal(showModal, hideModal)` - Returns a function that shows form modals and returns the modal ID
- `useStatusModal(showModal, hideModal)` - Returns a function that shows status modals and returns the modal ID

## Styling

The modal system uses CSS custom properties and can be themed by updating the variables in your CSS:

```css
:root {
  --card-bg: #ffffff;
  --card-border: #e5e7eb;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --hover-bg: #f3f4f6;
  --accent-color: #3b82f6;
  --secondary-bg: #f9fafb;
  --border-radius: 6px;
  --border-radius-lg: 12px;
}
```

## Features

- **Multiple Modal Support**: Stack multiple modals on top of each other
- **Responsive Design**: Automatically adapts to mobile screens
- **Keyboard Navigation**: Supports ESC key to close modals
- **Click Outside to Close**: Click backdrop to close modals
- **Animations**: Smooth fade-in and slide-up animations
- **Accessibility**: Proper focus management and ARIA attributes
- **Type Safety**: Full TypeScript support

## Migration from window.confirm

Replace old `window.confirm` calls:

```tsx
// Old way
if (window.confirm('Are you sure?')) {
  doSomething();
}

// New way
const confirmed = await showConfirmation({
  title: 'Confirm Action',
  message: 'Are you sure?',
  onConfirm: () => {}
});

if (confirmed) {
  doSomething();
}
```

## Best Practices

1. **Always use the helper hooks** for consistency
2. **Provide meaningful titles and messages** for confirmations
3. **Use appropriate modal sizes** for form content
4. **Make destructive actions clearly marked** with `isDestructive: true`
5. **Handle modal cleanup** in component unmount if needed
6. **Don't nest modals unnecessarily** - prefer closing one before opening another
