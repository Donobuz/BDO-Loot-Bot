import React, { useState, useRef, useEffect } from 'react';
import './SearchableSelect.css';

interface BaseOption {
  id: number;
  name: string;
}

interface SearchableSelectProps<T extends BaseOption> {
  options: T[];
  value: T | null;
  onChange: (option: T | null) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  // Custom display function for the selected value
  getDisplayValue?: (option: T) => string;
  // Custom display function for options in the dropdown
  getOptionDisplay?: (option: T) => { primary: string; secondary?: string };
  // Custom search function
  searchFunction?: (option: T, searchTerm: string) => boolean;
}

export const SearchableSelect = <T extends BaseOption>({
  options,
  value,
  onChange,
  placeholder = "Choose an option...",
  disabled = false,
  loading = false,
  getDisplayValue,
  getOptionDisplay,
  searchFunction
}: SearchableSelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<T[]>(options);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter options based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter(option => {
        if (searchFunction) {
          return searchFunction(option, searchTerm);
        }
        // Default search: search by name
        return option.name.toLowerCase().includes(searchTerm.toLowerCase());
      });
      setFilteredOptions(filtered);
    }
    setHighlightedIndex(-1);
  }, [searchTerm, options, searchFunction]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Prevent scroll event bubbling when dropdown is open
  useEffect(() => {
    if (isOpen) {
      // Only handle scrolling within the dropdown, let modal handle background prevention
      const handleDropdownScroll = (e: WheelEvent) => {
        // Only handle scrolling if it's within the dropdown list
        if (listRef.current && listRef.current.contains(e.target as Node)) {
          const list = listRef.current;
          const { scrollTop, scrollHeight, clientHeight } = list;
          const isScrollingUp = e.deltaY < 0;
          const isScrollingDown = e.deltaY > 0;
          
          // Prevent scrolling at boundaries
          if (
            (isScrollingUp && scrollTop <= 0) ||
            (isScrollingDown && scrollTop >= scrollHeight - clientHeight)
          ) {
            e.preventDefault();
          }
        }
      };

      document.addEventListener('wheel', handleDropdownScroll, { passive: false });
      
      return () => {
        document.removeEventListener('wheel', handleDropdownScroll);
      };
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelectOption(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        inputRef.current?.blur();
        break;
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [highlightedIndex]);

  const handleSelectOption = (option: T) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
    inputRef.current?.blur();
  };

  const handleInputClick = () => {
    if (!disabled && !loading) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
  };

  const getDefaultDisplayValue = (option: T): string => {
    return option.name;
  };

  const getDefaultOptionDisplay = (option: T): { primary: string; secondary?: string } => {
    return { primary: option.name };
  };

  const displayValue = value ? (getDisplayValue ? getDisplayValue(value) : getDefaultDisplayValue(value)) : '';
  const placeholderText = loading ? "Loading..." : placeholder;

  return (
    <div className={`searchable-select-component ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <div 
        className={`searchable-select-input ${isOpen ? 'open' : ''}`}
        onClick={handleInputClick}
      >
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          disabled={disabled || loading}
          className="searchable-select-search-input"
          autoComplete="off"
        />
        <div className={`searchable-select-dropdown-arrow ${isOpen ? 'open' : ''}`}>
          ▼
        </div>
      </div>

      {isOpen && !disabled && !loading && (
        <ul className="searchable-select-options-list" ref={listRef}>
          {filteredOptions.length === 0 ? (
            <li className="searchable-select-no-options">
              {searchTerm ? `No locations found for "${searchTerm}"` : 'No locations available'}
            </li>
          ) : (
            filteredOptions.map((option, index) => {
              const optionDisplay = getOptionDisplay ? getOptionDisplay(option) : getDefaultOptionDisplay(option);
              return (
                <li
                  key={option.id}
                  className={`searchable-select-option ${index === highlightedIndex ? 'highlighted' : ''}`}
                  onClick={() => handleSelectOption(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="searchable-select-option-name">{optionDisplay.primary}</span>
                  {optionDisplay.secondary && (
                    <span className="searchable-select-option-stats">{optionDisplay.secondary}</span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};
