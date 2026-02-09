# Demo: pull-all — git multi-repo updater
# Usage: vhs tapes/pull-all.tape

Output tapes/output/pull-all.gif

Require pull-all

Set Shell "bash"
Set FontSize 16
Set Width 1200
Set Height 700
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 60ms
Set CursorBlink false

# Show help
Type "pull-all --help"
Enter
Sleep 3s

# Dry-run to show what would be pulled
Type "pull-all ~/Documents/projects/personal --dry-run"
Enter
Sleep 5s
