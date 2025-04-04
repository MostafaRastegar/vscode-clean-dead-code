import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// Helper function to create a test file with content
async function createTestFile(content: string): Promise<vscode.Uri> {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "clean-dead-code-tests-")
  );
  const filePath = path.join(tmpDir, "test.js");
  fs.writeFileSync(filePath, content);
  return vscode.Uri.file(filePath);
}

// Helper function to open a file in the editor
async function openTextDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
  return document;
}

suite("CleanDeadCode Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start CleanDeadCode tests");

  test("Remove Unused Imports Test", async () => {
    // Create a test file with unused imports
    const initialContent = `import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import * as utils from './utils';

function MyComponent() {
  const [count, setCount] = useState(0);
  // Only useState is used, useEffect and useContext are unused
  // Also useNavigate and utils are unused
  
  return <div>{count}</div>;
}`;

    const expectedContent = `import React, { useState } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
  // Only useState is used, useEffect and useContext are unused
  // Also useNavigate and utils are unused
  
  return <div>{count}</div>;
}`;

    const uri = await createTestFile(initialContent);
    const document = await openTextDocument(uri);

    // Execute the clean imports command
    await vscode.commands.executeCommand("clean-code.removeUnusedImports");

    // Wait for the edit to be applied
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if the content is as expected
    assert.strictEqual(document.getText(), expectedContent);
  });

  test("Handle Unused Variables Test - Comment Mode", async () => {
    // Set the configuration to use comment mode
    await vscode.workspace
      .getConfiguration("cleanCode")
      .update(
        "unusedVariableAction",
        "comment",
        vscode.ConfigurationTarget.Global
      );

    // Create a test file with unused variables
    const initialContent = `function processData() {
  const data = fetchData();
  const config = getConfig(); // Unused variable
  
  console.log(data);
  
  return data;
}`;

    const expectedContent = `function processData() {
  const data = fetchData();
  // TODO: Unused variable
  // const config = getConfig(); // Unused variable
  
  console.log(data);
  
  return data;
}`;

    const uri = await createTestFile(initialContent);
    const document = await openTextDocument(uri);

    // Execute the handle unused variables command
    await vscode.commands.executeCommand("clean-code.handleUnusedVariables");

    // Wait for the edit to be applied
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if the content is as expected
    assert.strictEqual(document.getText(), expectedContent);
  });

  test("Handle Unused Parameters Test", async () => {
    // Create a test file with unused parameters
    const initialContent = `function processUser(userId, userName, userRole, userAge) {
  console.log(\`Processing \${userName}\`);
  // Only userName is used, other parameters are unused
}`;

    const expectedContent = `function processUser(_userId, userName) {
  console.log(\`Processing \${userName}\`);
  // Only userName is used, other parameters are unused
}`;

    const uri = await createTestFile(initialContent);
    const document = await openTextDocument(uri);

    // Execute the handle unused variables command
    await vscode.commands.executeCommand("clean-code.handleUnusedVariables");

    // Wait for the edit to be applied
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if the content is as expected
    assert.strictEqual(document.getText(), expectedContent);
  });

  test("Full Clean All Test", async () => {
    // Create a test file with unused imports, variables, and parameters
    const initialContent = `import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function MyComponent(props, theme, user) {
  const [count, setCount] = useState(0);
  const config = { debug: true };
  
  console.log(props);
  
  return <div>{count}</div>;
}`;

    const expectedContent = `import React, { useState } from 'react';

function MyComponent(props) {
  const [count, setCount] = useState(0);
  // TODO: Unused variable
  // const config = { debug: true };
  
  console.log(props);
  
  return <div>{count}</div>;
}`;

    const uri = await createTestFile(initialContent);
    const document = await openTextDocument(uri);

    // Execute the clean all command
    await vscode.commands.executeCommand("clean-code.cleanAll");

    // Wait for the edit to be applied
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if the content is as expected
    assert.strictEqual(document.getText(), expectedContent);
  });
});
