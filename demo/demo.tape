# Patchy Demo - 15 Second Version
# Shows: patches exist → upgrade upstream → reapply → verify
# Run with: ./run-demo.sh

Output demo.webm

# Terminal settings
Set Shell bash
Set FontSize 18
Set Width 900
Set Height 500
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms
Set CursorBlink false

# Setup: cd to workdir and configure aliases
Hide
Type "cd $DEMO_WORKDIR && alias tree='eza --tree -I scratch' && clear"
Enter
Sleep 500ms
Show

# Beat 0: Show patches structure
Sleep 300ms
Type "# Store changes as patches"
Sleep 200ms
Enter
Enter
Sleep 500ms

Type "tree patches/"
Sleep 200ms
Enter
Sleep 2s

# Beat 1: Change upstream base
Ctrl+l
Sleep 300ms

Type "# Change the upstream base to a new tag"
Sleep 200ms
Enter
Enter
Sleep 500ms

Type "patchy base v1.1.0"
Sleep 200ms
Enter
Sleep 1.2s

# Beat 2: Reset repo
Ctrl+l
Sleep 300ms

Type "# Reset repo"
Sleep 200ms
Enter
Enter
Sleep 500ms

Type "patchy repo reset --yes"
Sleep 200ms
Enter
Sleep 1.2s

# Beat 3: Reapply patches
Ctrl+l
Sleep 300ms

Type "# Reapply patches against new base"
Sleep 200ms
Enter
Enter
Sleep 500ms

Type "patchy apply --all"
Sleep 200ms
Enter
Sleep 1.5s

# Beat 4: Payoff
Ctrl+l
Sleep 300ms

Type "cat clones/patchy-demo-repo/scripts/build.sh"
Sleep 200ms
Enter
Sleep 3.5s
