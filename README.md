# CleanDeadCode

A VSCode extension for removing dead code in JavaScript and TypeScript files, focusing on:
1. Removing unused imports without changing their order
2. Managing unused variables and parameters

## Features

### 1. Remove Unused Imports
- Removes unused imports while preserving the order of remaining imports
- Supports all types of imports:
  - Default imports: `import React from 'react'`
  - Named imports: `import { useState, useEffect } from 'react'`
  - Named imports with aliases: `import { useState as useStateHook } from 'react'`
  - Namespace imports: `import * as ReactDOM from 'react-dom'`
  - Side-effect imports: `import 'styles.css'`

### 2. Manage Unused Variables and Parameters
- Regular unused variables: comment out with TODO or add `_` prefix
- Unused function parameters:
  - Add `_` prefix to unused parameters at the beginning or middle of functions
  - Optionally remove unused parameters at the end of functions (after the last used parameter)

### 3. Auto Mode
- Option to automatically clean code on file save
- Configurable through VSCode settings

## Usage

### Manual Execution
1. Open your JavaScript or TypeScript file
2. Use one of the following methods:
   - Right-click on the editor and select one of the "Clean Code" commands from the context menu
   - Use keyboard shortcuts:
     - `Ctrl+Alt+U` (Win/Linux) or `Cmd+Alt+U` (Mac) to remove unused imports
     - `Ctrl+Alt+V` (Win/Linux) or `Cmd+Alt+V` (Mac) to handle unused variables
     - `Ctrl+Alt+C` (Win/Linux) or `Cmd+Alt+C` (Mac) to perform both operations simultaneously
   - Open the Command Palette with `Ctrl+Shift+P` or `Cmd+Shift+P` and search for "Clean Code"

### Automatic Execution on File Save
1. Open VSCode settings (File > Preferences > Settings)
2. Search for "Clean Code"
3. Enable auto options:
   - `cleanCode.autoRemoveUnusedImports`: Automatically remove unused imports on save
   - `cleanCode.autoHandleUnusedVariables`: Automatically handle unused variables on save

## Settings

This extension provides the following settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `cleanCode.autoRemoveUnusedImports` | `false` | Automatically remove unused imports on file save |
| `cleanCode.autoHandleUnusedVariables` | `false` | Automatically handle unused variables on file save |
| `cleanCode.unusedVariableAction` | `comment` | How to handle unused variables. Options: `comment` (add TODO comment), `prefix` (add `_` prefix), or `ignore` (do nothing) |
| `cleanCode.removeTrailingParameters` | `true` | Remove unused parameters at the end of functions (after the last used parameter) |

## Installation

### From VSCode Marketplace
1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "CleanDeadCode"
4. Click Install

### Manual Installation
1. Download the .vsix file from the releases section
2. Open VSCode
3. Go to Extensions (Ctrl+Shift+X or Cmd+Shift+X)
4. Click the "..." menu in the top-right of the Extensions panel
5. Choose "Install from VSIX..." and select the downloaded file

## Examples

### Removing Unused Imports

**Before:**
```javascript
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import * as utils from './utils';

function MyComponent() {
  const [count, setCount] = useState(0);
  // Only useState is used, useEffect and useContext are unused
  // Also useNavigate and utils are unused
  
  return <div>{count}</div>;
}
```

**After:**
```javascript
import React, { useState } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
  
  return <div>{count}</div>;
}
```

### Managing Unused Variables

**Before:**
```javascript
function processData(userId, userName, userRole, userAge) {
  const data = fetchData();
  const config = getConfig(); // Unused variable
  
  console.log(`Processing ${userName}`);
  // Only userName is used, other parameters are unused
  
  return data;
}
```

**After (with unusedVariableAction: "comment"):**
```javascript
function processData(_userId, userName) {
  const data = fetchData();
  // TODO: Unused variable
  // const config = getConfig();
  
  console.log(`Processing ${userName}`);
  
  return data;
}
```

## Known Limitations

- Detection of unused variables may not be 100% accurate in complex codebases with static analysis
- Support for JSX/TSX for variables and parameters might not be complete in some edge cases
- Type parameters in TypeScript might be incorrectly flagged as unused

## License

MIT