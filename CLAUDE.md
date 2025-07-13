# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build production bundle
- `pnpm start` - Start production server

Uses pnpm as package manager (evidenced by pnpm-lock.yaml).

## Architecture Overview

This is a SolidJS application built with SolidStart that demonstrates a sophisticated TreeView component. The application uses file-based routing and is styled with TailwindCSS + DaisyUI.

### Core TreeView Architecture

The TreeView component is the centerpiece, implementing a professional tree interface with lazy loading, keyboard navigation, cut/paste operations, and in-place renaming. It follows a multi-layered architecture:

**Main Components:**
- `TreeView.tsx` - Main container component that manages state and orchestrates tree operations
- `TreeItem.tsx` - Individual tree node renderer with inline editing capabilities
- `tree/` directory contains the core tree logic

**Key Architectural Patterns:**

1. **Context-based State Management**: Uses `TreeContext` to share state between TreeView and TreeItem components
2. **Flat Data Structure**: Tree data is stored as a flat array with parent_id relationships, enabling efficient operations
3. **Lazy Loading**: Children are loaded on-demand via async `loadChildren` callback
4. **Virtual Root**: Uses `__virtual_root__` ID for top-level nodes
5. **Signal-based Reactivity**: Leverages SolidJS signals for reactive state management

**State Management Flow:**
- TreeView manages expanded nodes, focused/selected state, cut operations, and editing state
- TreeItem components access shared state via useTreeContext()
- Data mutations flow through callback props (onCutPaste, onRename, etc.)

**Tree Operations:**
- **Navigation**: Arrow keys, Home/End, with automatic scrolling
- **Cut/Paste**: Ctrl+X/Ctrl+V for moving nodes between parents
- **Rename**: F2 key triggers inline editing with input field
- **Expand/Collapse**: Space/Enter, with fold cycle operations

### File Structure Patterns

```
src/components/tree/
├── types.ts          # TypeScript interfaces and type definitions
├── constants.ts      # Keyboard shortcuts and animation classes
├── context.ts        # React context for tree state sharing
├── utils.ts          # Tree traversal and manipulation utilities
├── keyboard.ts       # Keyboard event handling logic
└── TreeItem.tsx      # Individual tree node component
```

The tree implementation separates concerns clearly: types define contracts, utils handle tree operations, keyboard manages input, and context enables component communication.

### Data Flow

1. **Initial Load**: TreeView loads root children via `loadChildren("__virtual_root__")`
2. **Expansion**: When user expands a node, TreeItem calls `loadChildren(nodeId)` 
3. **State Updates**: All operations update signals which trigger reactive re-renders
4. **External Callbacks**: User actions trigger callbacks (onRename, onCutPaste) to update external data sources

### Tree Example Implementation

`routes/tree-example.tsx` demonstrates proper TreeView usage:
- Maintains flat data structure with parent_id relationships
- Implements cut/paste operations by updating parent_id fields
- Implements rename by updating label fields
- Provides context menu and button controls for tree operations

## Key Implementation Details

- **Keyboard Shortcuts**: Defined in `tree/constants.ts`, handled in `tree/keyboard.ts`
- **Animation**: Uses solid-transition-group with TailwindCSS classes
- **Accessibility**: Proper ARIA attributes and keyboard navigation
- **TypeScript**: Fully typed with comprehensive interfaces in `tree/types.ts`
- **Styling**: DaisyUI components with TailwindCSS utilities

## Path Aliases

Uses `~/*` alias pointing to `./src/*` (configured in tsconfig.json).