import { createCodeBlockSpec } from '@blocknote/core';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { CodeBlockLanguagePicker } from './CodeBlockLanguagePicker';
import { codeBlockOptions } from '@blocknote/code-block';

/**
 * 完美的 CodeBlock Spec
 * - 基於官方 createCodeBlockSpec，保持 100% 原始 ProseMirror <pre><code> 節點與 Markdown 序列化能力
 * - 徹底杜絕 React 自定義 block 序列化產生的 "CODE BLOCKJavaScript```" 字元污染
 * - 透過 DOM-level render 替換為漂亮的 React Input Search + Dropdown Box Selection 語言選擇器
 */
export const createCustomCodeBlockSpec = () => {
  const defaultSpec = createCodeBlockSpec(codeBlockOptions);

  return {
    ...defaultSpec,
    implementation: {
      ...defaultSpec.implementation,
      render: (block: any, editor: any) => {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        pre.appendChild(code);

        const fragment = document.createDocumentFragment();

        // 建立浮動於代碼塊右上角的語言選取器容器
        const pickerContainer = document.createElement('div');
        pickerContainer.contentEditable = 'false';
        pickerContainer.className = 'custom-code-picker-container';
        pickerContainer.style.position = 'absolute';
        pickerContainer.style.top = '6px';
        pickerContainer.style.right = '10px';
        pickerContainer.style.zIndex = '50';
        pickerContainer.style.userSelect = 'none';

        const root = createRoot(pickerContainer);
        const handleLanguageChange = (newLang: string) => {
          if (!editor.isEditable) return;
          editor.updateBlock(block.id, {
            props: { language: newLang },
          });
        };

        root.render(
          React.createElement(CodeBlockLanguagePicker, {
            language: block.props.language,
            onSelectLanguage: handleLanguageChange,
            disabled: !editor.isEditable,
          })
        );

        fragment.appendChild(pickerContainer);
        fragment.appendChild(pre);

        return {
          dom: fragment,
          contentDOM: code,
          destroy: () => {
            setTimeout(() => {
              root.unmount();
            }, 0);
          },
        };
      },
    },
  };
};
