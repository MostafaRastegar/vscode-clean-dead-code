// Enhanced VSCode Extension with both import cleaning and unused variable handling
// Supports both manual execution and auto-run on save

import * as vscode from "vscode";
import * as ts from "typescript";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  // Register command for removing unused imports
  const removeImportsCommand = vscode.commands.registerCommand(
    "clean-code.removeUnusedImports",
    removeUnusedImports
  );

  // Register command for handling unused variables
  const handleUnusedVarsCommand = vscode.commands.registerCommand(
    "clean-code.handleUnusedVariables",
    handleUnusedVariables
  );

  // Register "clean all" command which runs both
  const cleanAllCommand = vscode.commands.registerCommand(
    "clean-code.cleanAll",
    async () => {
      await removeUnusedImports();
      await handleUnusedVariables();
    }
  );

  // Register auto-save event listener
  const onWillSaveTextDocument = vscode.workspace.onWillSaveTextDocument(
    (e) => {
      // Only process JS/TS files
      if (
        ![".js", ".jsx", ".ts", ".tsx"].includes(
          path.extname(e.document.fileName)
        )
      ) {
        return;
      }

      const config = vscode.workspace.getConfiguration("cleanCode");

      // Queue cleanup actions based on settings
      if (config.get("autoRemoveUnusedImports")) {
        e.waitUntil(performRemoveUnusedImports(e.document));
      }

      if (config.get("autoHandleUnusedVariables")) {
        e.waitUntil(performHandleUnusedVariables(e.document));
      }
    }
  );

  // Add all disposables to the context
  context.subscriptions.push(
    removeImportsCommand,
    handleUnusedVarsCommand,
    cleanAllCommand,
    onWillSaveTextDocument
  );
}

// Command implementation for removing unused imports
async function removeUnusedImports() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("No editor is active");
    return;
  }

  const document = editor.document;
  if (
    ![".js", ".jsx", ".ts", ".tsx"].includes(path.extname(document.fileName))
  ) {
    vscode.window.showInformationMessage("Not a JavaScript or TypeScript file");
    return;
  }

  try {
    const edit = await performRemoveUnusedImports(document);
    if (!edit) {
      vscode.window.showInformationMessage("No unused imports found");
      return;
    }

    // Apply the edit
    await vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage("Unused imports have been removed");
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Command implementation for handling unused variables
async function handleUnusedVariables() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("No editor is active");
    return;
  }

  const document = editor.document;
  if (
    ![".js", ".jsx", ".ts", ".tsx"].includes(path.extname(document.fileName))
  ) {
    vscode.window.showInformationMessage("Not a JavaScript or TypeScript file");
    return;
  }

  try {
    const edit = await performHandleUnusedVariables(document);
    if (!edit) {
      vscode.window.showInformationMessage("No unused variables found");
      return;
    }

    // Apply the edit
    await vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage("Unused variables have been handled");
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Logic for removing unused imports (returns a WorkspaceEdit or null if no changes)
async function performRemoveUnusedImports(
  document: vscode.TextDocument
): Promise<vscode.WorkspaceEdit | null> {
  const fileContent = document.getText();
  const sourceFile = ts.createSourceFile(
    path.basename(document.fileName),
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  // Collect all identifier references in the source file
  const usedIdentifiers = collectUsedIdentifiers(sourceFile);

  // Process and clean all imports
  const updatedContent = cleanUnusedImports(
    sourceFile,
    fileContent,
    usedIdentifiers
  );

  // If nothing changed, return null
  if (updatedContent === fileContent) {
    return null;
  }

  // Create a workspace edit
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(fileContent.length)
  );
  edit.replace(document.uri, fullRange, updatedContent);

  return edit;
}

// Logic for handling unused variables (returns a WorkspaceEdit or null if no changes)
async function performHandleUnusedVariables(
  document: vscode.TextDocument
): Promise<vscode.WorkspaceEdit | null> {
  const fileContent = document.getText();
  const sourceFile = ts.createSourceFile(
    path.basename(document.fileName),
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  // Get the configuration for handling unused variables
  const config = vscode.workspace.getConfiguration("cleanCode");
  const unusedVarAction = config.get<string>("unusedVariableAction", "comment");

  // Collect used and declared variables
  const usedIdentifiers = collectUsedIdentifiers(sourceFile);
  const { unusedVariables, unusedParameters } = findUnusedVariablesAndParams(
    sourceFile,
    usedIdentifiers
  );

  // If nothing found, return null
  if (unusedVariables.length === 0 && unusedParameters.length === 0) {
    return null;
  }

  // Create a workspace edit
  const edit = new vscode.WorkspaceEdit();

  // Handle unused variables based on configuration
  if (unusedVarAction === "comment") {
    // Comment out unused variables
    for (const variable of unusedVariables) {
      // We need to get the entire variable declaration statement
      // This requires traversing up to find the parent VariableDeclarationList
      // and then to the VariableStatement

      let currentNode: ts.Node = variable;
      let variableStatement: ts.VariableStatement | null = null;

      // Find the parent VariableStatement
      while (currentNode && !variableStatement) {
        if (ts.isVariableStatement(currentNode)) {
          variableStatement = currentNode;
          break;
        }
        currentNode = currentNode.parent;
      }

      if (variableStatement) {
        // Handle the entire statement
        const stmtStart = document.positionAt(
          variableStatement.getStart(sourceFile)
        );
        const stmtEnd = document.positionAt(variableStatement.getEnd());
        const stmtRange = new vscode.Range(stmtStart, stmtEnd);
        const originalText = document.getText(stmtRange);

        edit.replace(
          document.uri,
          stmtRange,
          `// TODO: Unused variable\n// ${originalText}`
        );
      } else {
        // Fallback to variable-only if we can't find the statement
        const lineStart = document.positionAt(variable.getStart(sourceFile));
        const lineEnd = document.positionAt(variable.getEnd());
        const lineRange = new vscode.Range(lineStart, lineEnd);
        const originalText = document.getText(lineRange);

        edit.replace(
          document.uri,
          lineRange,
          `// TODO: Unused variable\n// ${originalText}`
        );
      }
    }
  }

  // Handle unused parameters by adding underscore prefix
  // For unused parameters, we need to modify function signatures
  handleUnusedFunctionParameters(document, sourceFile, unusedParameters, edit);

  return edit;
}

// Collect all identifier references in the file
function collectUsedIdentifiers(sourceFile: ts.SourceFile): Set<string> {
  const usedIdentifiers = new Set<string>();
  const importNodes = new Set<ts.Node>();
  const declarationNodes = new Set<ts.Node>();

  // First, identify all import declarations to exclude them from identifier search
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node)) {
      importNodes.add(node);
    }
  });

  // Collect all declaration names to track them separately
  function collectDeclarations(node: ts.Node) {
    // Variable declarations
    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name)) {
        declarationNodes.add(node.name);
      }
    }
    // Function parameters
    else if (ts.isParameter(node)) {
      if (ts.isIdentifier(node.name)) {
        declarationNodes.add(node.name);
      }
    }
    // Function declarations
    else if (ts.isFunctionDeclaration(node) && node.name) {
      declarationNodes.add(node.name);
    }

    ts.forEachChild(node, collectDeclarations);
  }

  collectDeclarations(sourceFile);

  // Visit all nodes to collect used identifiers, excluding import declarations
  function visit(node: ts.Node) {
    // Skip import declarations when collecting used identifiers
    if (importNodes.has(node)) {
      return;
    }

    // Collect usages, not declarations
    if (ts.isIdentifier(node) && !declarationNodes.has(node)) {
      usedIdentifiers.add(node.text);
    }

    // Continue the recursion
    ts.forEachChild(node, visit);
  }

  // Start the traversal
  ts.forEachChild(sourceFile, visit);

  return usedIdentifiers;
}

// Find unused variables and parameters
function findUnusedVariablesAndParams(
  sourceFile: ts.SourceFile,
  usedIdentifiers: Set<string>
): {
  unusedVariables: ts.VariableDeclaration[];
  unusedParameters: ts.ParameterDeclaration[];
} {
  const unusedVariables: ts.VariableDeclaration[] = [];
  const unusedParameters: ts.ParameterDeclaration[] = [];

  function visit(node: ts.Node) {
    // Check for variable declarations
    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name) && !usedIdentifiers.has(node.name.text)) {
        // Skip variables that already start with underscore
        if (!node.name.text.startsWith("_")) {
          unusedVariables.push(node);
        }
      }
    }
    // Check for function parameters
    else if (ts.isParameter(node)) {
      if (ts.isIdentifier(node.name) && !usedIdentifiers.has(node.name.text)) {
        // Skip parameters that already start with underscore
        if (!node.name.text.startsWith("_")) {
          unusedParameters.push(node);
        }
      }
    }

    // Continue traversal
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  return { unusedVariables, unusedParameters };
}

// Handle unused function parameters by adding underscore prefix or removing them
function handleUnusedFunctionParameters(
  document: vscode.TextDocument,
  sourceFile: ts.SourceFile,
  unusedParameters: ts.ParameterDeclaration[],
  edit: vscode.WorkspaceEdit
) {
  // Group parameters by their parent function
  const paramsByFunction = new Map<ts.Node, ts.ParameterDeclaration[]>();

  for (const param of unusedParameters) {
    const parent = param.parent;
    if (!paramsByFunction.has(parent)) {
      paramsByFunction.set(parent, []);
    }
    paramsByFunction.get(parent)!.push(param);
  }

  // Process each function
  for (const [functionNode, params] of paramsByFunction.entries()) {
    // Get all parameters of the function
    const allParams = (functionNode as ts.FunctionLikeDeclaration).parameters;

    // Find the last used parameter index
    let lastUsedIndex = -1;
    for (let i = allParams.length - 1; i >= 0; i--) {
      const param = allParams[i];
      if (!params.includes(param)) {
        lastUsedIndex = i;
        break;
      }
    }

    // For each unused parameter
    for (const param of params) {
      const paramIndex = allParams.indexOf(param);

      // If parameter is after the last used one, it should be removed
      if (paramIndex > lastUsedIndex) {
        // For now, we'll skip removal since it requires more complex handling
        // This would involve removing the parameter and possibly the comma
        continue;
      }

      // Otherwise, prefix with underscore
      if (ts.isIdentifier(param.name)) {
        const paramPos = document.positionAt(param.name.getStart(sourceFile));
        const paramEndPos = document.positionAt(param.name.getEnd());
        const paramRange = new vscode.Range(paramPos, paramEndPos);

        edit.replace(document.uri, paramRange, `_${param.name.text}`);
      }
    }
  }
}

// Process and clean all imports in the file
function cleanUnusedImports(
  sourceFile: ts.SourceFile,
  fileContent: string,
  usedIdentifiers: Set<string>
): string {
  const importChanges: { start: number; end: number; replacement: string }[] =
    [];

  // Process all import declarations
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node)) {
      const importClause = node.importClause;

      // Skip side-effect imports (import 'module');
      if (!importClause) {
        return;
      }

      // Handle default import
      let defaultImportUsed = true;
      if (importClause.name) {
        defaultImportUsed = usedIdentifiers.has(importClause.name.text);
      }

      // Handle named imports
      if (importClause.namedBindings) {
        if (ts.isNamedImports(importClause.namedBindings)) {
          // Process named imports: import { a, b, c } from 'module'
          const namedImports = importClause.namedBindings.elements;
          const usedNamedImports = namedImports.filter((element) =>
            usedIdentifiers.has(element.name.text)
          );

          // If some named imports are unused
          if (usedNamedImports.length < namedImports.length) {
            // If default import exists and no named imports are used
            if (importClause.name && usedNamedImports.length === 0) {
              if (defaultImportUsed) {
                // Just remove the named imports part
                importChanges.push({
                  start: importClause.namedBindings.getStart(),
                  end: importClause.namedBindings.getEnd(),
                  replacement: "",
                });
              } else {
                // If default is also unused, remove entire import
                importChanges.push({
                  start: node.getStart(),
                  end: node.getEnd(),
                  replacement: "",
                });
              }
            } else {
              // Replace with only used named imports
              const newNamedImports = usedNamedImports
                .map((element) => {
                  const propertyName = element.propertyName
                    ? `${element.propertyName.text} as `
                    : "";
                  return `${propertyName}${element.name.text}`;
                })
                .join(", ");

              // If no default import or default import is used
              if (!importClause.name || defaultImportUsed) {
                if (usedNamedImports.length > 0) {
                  importChanges.push({
                    start: importClause.namedBindings.getStart(),
                    end: importClause.namedBindings.getEnd(),
                    replacement: `{ ${newNamedImports} }`,
                  });
                } else {
                  // If all named imports are unused, remove them
                  importChanges.push({
                    start: importClause.namedBindings.getStart(),
                    end: importClause.namedBindings.getEnd(),
                    replacement: "",
                  });
                }
              } else {
                // If default import is unused and there are used named imports
                if (usedNamedImports.length > 0) {
                  // Remove default import, keep used named imports
                  importChanges.push({
                    start: node.getStart(),
                    end: node.getEnd(),
                    replacement: `import { ${newNamedImports} } from ${node.moduleSpecifier.getText()};`,
                  });
                } else {
                  // If all imports are unused, remove entire import
                  importChanges.push({
                    start: node.getStart(),
                    end: node.getEnd(),
                    replacement: "",
                  });
                }
              }
            }
          } else if (!defaultImportUsed && importClause.name) {
            // Named imports all used, but default import unused
            // Create a completely new import statement with just the named imports
            const namedBindings = importClause.namedBindings;
            if (namedBindings && ts.isNamedImports(namedBindings)) {
              const namedImportsText = namedBindings.elements
                .map((element) => {
                  const propertyName = element.propertyName
                    ? `${element.propertyName.text} as `
                    : "";
                  return `${propertyName}${element.name.text}`;
                })
                .join(", ");

              importChanges.push({
                start: node.getStart(),
                end: node.getEnd(),
                replacement: `import { ${namedImportsText} } from ${node.moduleSpecifier.getText()};`,
              });
            } else {
              // Fallback to the original approach if we encounter an unexpected structure
              importChanges.push({
                start: importClause.name.getStart(),
                end: importClause.name.getEnd() + 1, // +1 for the comma
                replacement: "",
              });
            }
          }
        } else if (ts.isNamespaceImport(importClause.namedBindings)) {
          // Handle namespace import: import * as X from 'module'
          const namespaceImport = importClause.namedBindings;
          const isNamespaceUsed = usedIdentifiers.has(
            namespaceImport.name.text
          );

          if (!isNamespaceUsed) {
            if (importClause.name && defaultImportUsed) {
              // Default used, namespace unused
              importChanges.push({
                start: importClause.name.getEnd() + 1, // After default import
                end: importClause.getEnd(),
                replacement: "",
              });
            } else {
              // Entire import unused
              importChanges.push({
                start: node.getStart(),
                end: node.getEnd(),
                replacement: "",
              });
            }
          } else if (importClause.name && !defaultImportUsed) {
            // Namespace used, default unused
            importChanges.push({
              start: importClause.name.getStart(),
              end: importClause.name.getEnd() + 1, // +1 for the comma
              replacement: "",
            });
          }
        }
      } else if (importClause.name && !defaultImportUsed) {
        // Only default import and it's unused
        importChanges.push({
          start: node.getStart(),
          end: node.getEnd(),
          replacement: "",
        });
      }
    }
  });

  // Apply all changes in reverse order to maintain positions
  let result = fileContent;
  importChanges
    .sort((a, b) => b.start - a.start) // Sort in reverse order
    .forEach((change) => {
      result =
        result.substring(0, change.start) +
        change.replacement +
        result.substring(change.end);
    });

  // Clean up empty lines after removing imports
  result = cleanEmptyLines(result);

  return result;
}

// Clean up empty lines after imports are removed
function cleanEmptyLines(content: string): string {
  // Replace any sequence of multiple blank lines with a single blank line
  return content.replace(/\n\s*\n\s*\n/g, "\n\n");
}

export function deactivate() {}
