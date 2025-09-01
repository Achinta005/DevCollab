import React from 'react';
const isBrowser = typeof window !== 'undefined';
// Lazy import Monaco binding to avoid SSR issues
let MonacoBinding = null;
if (isBrowser) {
  import('y-monaco').then((module) => {
    MonacoBinding = module.MonacoBinding;
  });
}


export const setupEnhancedMonacoBinding = (ytext, editor, provider) => {
  // Import dynamically to avoid SSR issues
  if (typeof window === 'undefined') return null;
  
  
  // Create the binding
  const binding = new MonacoBinding(
    ytext,
    editor.getModel(),
    new Set([editor]),
    provider.awareness
  );

  // Track cursor position and selection changes
  const updateCursorPosition = () => {
    const selection = editor.getSelection();
    const position = editor.getPosition();
    
    if (selection && position) {
      provider.awareness.setLocalStateField('cursor', {
        line: position.lineNumber,
        column: position.column,
        timestamp: Date.now()
      });
      
      // Track selection if text is selected
      if (!selection.isEmpty()) {
        provider.awareness.setLocalStateField('selection', {
          startLine: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLine: selection.endLineNumber,
          endColumn: selection.endColumn,
          text: editor.getModel().getValueInRange(selection),
          timestamp: Date.now()
        });
      } else {
        provider.awareness.setLocalStateField('selection', null);
      }
    }
  };

  // Listen for cursor position changes
  const cursorChangeDisposable = editor.onDidChangeCursorPosition(updateCursorPosition);
  const selectionChangeDisposable = editor.onDidChangeCursorSelection(updateCursorPosition);

  // Track typing activity
  let typingTimeout;
  const updateTypingStatus = (isTyping) => {
    provider.awareness.setLocalStateField('typing', {
      isTyping,
      timestamp: Date.now()
    });
    
    if (isTyping) {
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        provider.awareness.setLocalStateField('typing', {
          isTyping: false,
          timestamp: Date.now()
        });
      }, 2000); // Stop showing typing after 2 seconds of inactivity
    }
  };

  const contentChangeDisposable = editor.onDidChangeModelContent(() => {
    updateTypingStatus(true);
  });

  // Initial cursor position
  updateCursorPosition();

  // Enhanced cleanup function
  const originalDestroy = binding.destroy.bind(binding);
  binding.destroy = () => {
    cursorChangeDisposable.dispose();
    selectionChangeDisposable.dispose();
    contentChangeDisposable.dispose();
    clearTimeout(typingTimeout);
    originalDestroy();
  };

  return binding;
};

/**
 * Create cursor decorations for other users
 */
export const createCursorDecorations = (editor, connectedUsers) => {
  if (typeof window === 'undefined' || !editor) return [];
  
  const decorations = [];
  
  // Import monaco dynamically
  const monaco = window.monaco;
  if (!monaco) return [];
  
  connectedUsers.forEach(user => {
    if (user.cursor) {
      // Create cursor decoration
      const cursorDecoration = {
        range: new monaco.Range(
          user.cursor.line,
          user.cursor.column,
          user.cursor.line,
          user.cursor.column
        ),
        options: {
          className: `user-cursor-${user.clientId}`,
          beforeContentClassName: `user-cursor-line-${user.clientId}`,
          afterContentClassName: `user-cursor-label-${user.clientId}`,
          hoverMessage: {
            value: `${user.userName}'s cursor`
          }
        }
      };
      
      decorations.push(cursorDecoration);
    }

    // Create selection decoration
    if (user.selection) {
      const selectionDecoration = {
        range: new monaco.Range(
          user.selection.startLine,
          user.selection.startColumn,
          user.selection.endLine,
          user.selection.endColumn
        ),
        options: {
          className: `user-selection-${user.clientId}`,
          hoverMessage: {
            value: `${user.userName}'s selection: "${user.selection.text}"`
          }
        }
      };
      
      decorations.push(selectionDecoration);
    }
  });

  return editor.deltaDecorations([], decorations);
};

/**
 * Generate CSS styles for user cursors and selections
 */
export const generateUserStyles = (connectedUsers) => {
  const styles = [];
  
  connectedUsers.forEach(user => {
    const color = user.color || '#6B7280';
    const userId = user.clientId;
    
    // Cursor styles
    styles.push(`
      .user-cursor-${userId} {
        border-left: 2px solid ${color} !important;
        position: relative;
      }
      
      .user-cursor-line-${userId}::before {
        content: '';
        position: absolute;
        top: 0;
        left: -1px;
        width: 2px;
        height: 100%;
        background-color: ${color};
        z-index: 10;
      }
      
      .user-cursor-label-${userId}::after {
        content: '${user.userName || 'User'}';
        position: absolute;
        top: -20px;
        left: -1px;
        background-color: ${color};
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 500;
        white-space: nowrap;
        z-index: 100;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      .user-cursor-${userId}:hover .user-cursor-label-${userId}::after {
        opacity: 1;
      }
      
      /* Selection styles */
      .user-selection-${userId} {
        background-color: ${color}33 !important;
        border: 1px solid ${color}66;
        border-radius: 2px;
      }
      
      /* Typing indicator styles */
      .user-typing-${userId} {
        animation: typing-pulse 1s infinite;
      }
      
      @keyframes typing-pulse {
        0%, 50%, 100% { opacity: 1; }
        25%, 75% { opacity: 0.5; }
      }
    `);
  });
  
  return styles.join('\n');
};

/**
 * Inject user styles into the document
 */
export const injectUserStyles = (connectedUsers) => {
  // Remove existing user styles
  const existingStyle = document.getElementById('collaboration-user-styles');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  // Generate and inject new styles
  if (connectedUsers.length > 0) {
    const styles = generateUserStyles(connectedUsers);
    const styleElement = document.createElement('style');
    styleElement.id = 'collaboration-user-styles';
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
};

/**
 * Hook for managing cursor decorations in React component
 */
export const useCursorDecorations = (editor, connectedUsers) => {
  const [decorationIds, setDecorationIds] = React.useState([]);
  
  React.useEffect(() => {
    if (!editor || typeof window === 'undefined') return;
    
    // Update decorations when users change
    const newDecorationIds = createCursorDecorations(editor, connectedUsers);
    
    // Clean up old decorations
    if (decorationIds.length > 0) {
      editor.deltaDecorations(decorationIds, []);
    }
    
    setDecorationIds(newDecorationIds);
    
    // Inject CSS styles for cursors
    injectUserStyles(connectedUsers);
    
    return () => {
      // Cleanup on unmount
      if (decorationIds.length > 0 && editor) {
        editor.deltaDecorations(decorationIds, []);
      }
    };
  }, [editor, connectedUsers]);
  
  return decorationIds;
};

/**
 * Format user activity for display
 */
export const formatUserActivity = (user) => {
  const activities = [];
  
  // Check typing status
  if (user.typing && user.typing.isTyping) {
    const timeSinceTyping = Date.now() - user.typing.timestamp;
    if (timeSinceTyping < 3000) { // Show typing for 3 seconds
      activities.push('typing');
    }
  }
  
  // Check cursor activity
  if (user.cursor) {
    const timeSinceCursor = Date.now() - user.cursor.timestamp;
    if (timeSinceCursor < 30000) { // Active if cursor moved in last 30 seconds
      activities.push('active');
    }
  }
  
  // Check selection
  if (user.selection) {
    activities.push('selecting');
  }
  
  return activities.length > 0 ? activities : ['idle'];
};

/**
 * Get activity icon for user
 */
export const getActivityIcon = (activities) => {
  if (activities.includes('typing')) {
    return { icon: 'edit', color: 'text-green-400', pulse: true };
  }
  if (activities.includes('selecting')) {
    return { icon: 'mouse-pointer', color: 'text-blue-400', pulse: false };
  }
  if (activities.includes('active')) {
    return { icon: 'eye', color: 'text-slate-400', pulse: false };
  }
  return { icon: 'clock', color: 'text-slate-500', pulse: false };
};

/**
 * Enhanced awareness state manager
 */
export class AwarenessManager {
  constructor(provider, userId, userName) {
    this.provider = provider;
    this.userId = userId;
    this.userName = userName;
    this.lastActivity = Date.now();
    this.activityTimer = null;
    
    this.init();
  }
  
  init() {
    // Set initial state
    this.provider.awareness.setLocalState({
      userId: this.userId,
      userName: this.userName,
      color: this.generateUserColor(this.userId),
      joinedAt: Date.now(),
      lastActivity: Date.now()
    });
    
    // Update activity periodically
    this.activityTimer = setInterval(() => {
      this.updateActivity();
    }, 10000); // Update every 10 seconds
  }
  
  updateActivity() {
    this.lastActivity = Date.now();
    this.provider.awareness.setLocalStateField('lastActivity', this.lastActivity);
  }
  
  setCursor(line, column) {
    this.provider.awareness.setLocalStateField('cursor', {
      line,
      column,
      timestamp: Date.now()
    });
    this.updateActivity();
  }
  
  setSelection(startLine, startColumn, endLine, endColumn, text) {
    this.provider.awareness.setLocalStateField('selection', {
      startLine,
      startColumn,
      endLine,
      endColumn,
      text: text.substring(0, 100), // Limit selection text length
      timestamp: Date.now()
    });
    this.updateActivity();
  }
  
  clearSelection() {
    this.provider.awareness.setLocalStateField('selection', null);
    this.updateActivity();
  }
  
  setTyping(isTyping) {
    this.provider.awareness.setLocalStateField('typing', {
      isTyping,
      timestamp: Date.now()
    });
    this.updateActivity();
  }
  
  generateUserColor(userId) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#AED6F1', '#E8DAEF', '#FADBD8'
    ];
    
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return colors[Math.abs(hash) % colors.length];
  }
  
  destroy() {
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
    }
  }
}

export default {
  setupEnhancedMonacoBinding,
  createCursorDecorations,
  generateUserStyles,
  injectUserStyles,
  useCursorDecorations,
  formatUserActivity,
  getActivityIcon,
  AwarenessManager
};