# Patchy Demo - Full Lifecycle
# Run with: ./run-demo.sh

Output demo.webm

# Terminal settings
Set Shell bash
Set FontSize 18
Set Width 900
Set Height 550
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set CursorBlink false

# Setup: cd to workdir and configure aliases
Hide
Type "cd $DEMO_WORKDIR && alias tree='eza --tree -I scratch' && clear"
Enter
Sleep 500ms
Show

# === SECTION 1: Show project state ===
Sleep 1s
Type "# Patchy: maintain patches against upstream repos"
Sleep 300ms
Enter
Sleep 1.5s

Type "cat patchy.json"
Sleep 300ms
Enter
Sleep 2.5s

Type "patchy repo clone"
Sleep 300ms
Enter
Sleep 2s
Enter
Sleep 500ms

Type "tree clones/patchy-demo-repo/"
Sleep 300ms
Enter
Sleep 2.5s
Enter
Sleep 500ms

# === SECTION 2: Make a change ===
Type "clear"
Enter
Sleep 500ms

Type "# Make changes directly in cloned repo"
Sleep 300ms
Enter
Sleep 1s

Type "cat clones/patchy-demo-repo/scripts/build.sh"
Sleep 300ms
Enter
Sleep 1.5s

Type `echo 'echo "Custom build step"' >> clones/patchy-demo-repo/scripts/build.sh`
Sleep 300ms
Enter
Sleep 1s

# === SECTION 3: Generate patch ===
Type "patchy generate"
Sleep 300ms
Enter
Sleep 800ms

# Prompt: new patch set name
Type "custom-build"
Sleep 300ms
Enter
Sleep 2s

# === SECTION 4: Show the patch (hero shot) ===
Type "clear"
Enter
Sleep 500ms

Type "# Patches are stored in numbered changesets, mirroring the folder structure"
Sleep 300ms
Enter
Sleep 1s

Type "tree patches/"
Sleep 300ms
Enter
Sleep 1.5s

Type "bat patches/001-custom-build/scripts/build.sh.diff"
Sleep 300ms
Enter
Sleep 3.5s

# === SECTION 5: Upgrade upstream ===
Type "clear"
Enter
Sleep 500ms

Type "# Lets reapply our changes to a newer tag of the upstream repo"
Sleep 300ms
Enter
Sleep 1s

Type "patchy base v1.1.0"
Sleep 300ms
Enter
Sleep 1.5s

Type "patchy repo reset --yes"
Sleep 300ms
Enter
Sleep 1.5s

# === SECTION 6: Re-apply patches (the magic) ===
Type "patchy apply --all"
Sleep 300ms
Enter
Sleep 2s

# === SECTION 7: Payoff - prove it worked ===
Type "clear"
Enter
Sleep 500ms

Type "# Our custom changes have been applied to the freshly cloned repo"
Sleep 300ms
Enter
Sleep 1s

Type "cat clones/patchy-demo-repo/scripts/build.sh"
Sleep 300ms
Enter
Sleep 4s
