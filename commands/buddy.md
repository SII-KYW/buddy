Show the user's virtual pet (Buddy) status. Run the buddy viewer script and display the output.

Run this command:
```bash
node ~/.claude/scripts/buddy/view.mjs
```

If the user asks to interact with the pet, run the corresponding action:
- Feed: `node ~/.claude/scripts/buddy/view.mjs feed`
- Play: `node ~/.claude/scripts/buddy/view.mjs play`
- Sleep: `node ~/.claude/scripts/buddy/view.mjs sleep`
- Hatch new pet: `node ~/.claude/scripts/buddy/view.mjs hatch`

Always show the script output to the user. The pet has hunger, happiness, and energy stats that decay over time — encourage the user to take care of their buddy!
