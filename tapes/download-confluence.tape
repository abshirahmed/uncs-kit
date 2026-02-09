# Demo: download-confluence — export pages as markdown
# Usage: vhs tapes/download-confluence.tape

Output tapes/output/download-confluence.gif

Require download-confluence

Set Shell "bash"
Set FontSize 16
Set Width 1200
Set Height 700
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 60ms
Set CursorBlink false

# Show all available commands
Type "download-confluence --help"
Enter
Sleep 4s

# Show space download options
Type "download-confluence space --help"
Enter
Sleep 4s
