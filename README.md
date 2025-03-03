# vim-jumplist

<video controls muted>
  <source src="https://github.com/bzy-debug-orgnization/vscode-extension-vim-jumplist/raw/refs/heads/main/assets/illustration.mp4" type="video/mp4"/>
</video>

This extension provides the following commands to imitate the jumplist feature in Vim:

- `vim-jumplist.registerJump`: register current cursor position to jumplist
- `vim-jumplist.jumpBackward`: jump to the previous position in jumplist
- `vim-jumplist.jumpForward`: jump to the next position in jumplist
- `vim-jumplist.jump`: choose a position in jumplist to jump to
- `vim-jumplist.clear`: clear jumplist

This extension is best used with the [vscode vim extension](http://aka.ms/vscodevim).

Setup those keybindings in your `settings.json`:

```json
  "vim.normalModeKeyBindingsNonRecursive": [
    {
      "before": ["C-o"],
      "commands": ["vim-jumplist.jumpBack"]
    },
    {
      "before": ["C-i"],
      "commands": ["vim-jumplist.jumpForward"]
    },
    {
      "before": ["g", "d"],
      "commands": [
        "vim-jumplist.registerJump",
        "editor.action.revealDefinition"
      ]
    },
    ... // bind `vim-jumplist.registerJump` to anywhere you want to register a jump
  ],
  "vim.visualModeKeyBindingsNonRecursive": [
    {
      "before": ["C-o"],
      "commands": ["vim-jumplist.jumpBack"]
    },
    {
      "before": ["C-i"],
      "commands": ["vim-jumplist.jumpForward"]
    }
  ]
```

## Roadmap

- [ ] support jumplist stack option
