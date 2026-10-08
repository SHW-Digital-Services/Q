export const premiumTools = {
  scenarios: [
    { id: 'boundary', title: 'Set a boundary', opening: 'Can you do this for me again? It will only take a minute.', pushback: 'But you always helped before. Why is this different?', hint: 'State what you can offer, keep the limit clear, and avoid promising more than you want to give.' },
    { id: 'privacy', title: 'Ask for privacy', opening: 'Why have you not told everyone about this?', pushback: 'Surely it is easier if I just tell them for you?', hint: 'Name what is private, say who can be told, and ask the person to check with you first.' },
    { id: 'support', title: 'Ask for support', opening: 'You seem quiet. What would help right now?', pushback: 'I am not sure what you need me to do.', hint: 'Ask for one specific action, such as listening for ten minutes or helping with one task.' },
    { id: 'repair', title: 'Repair a misunderstanding', opening: 'What you said earlier hurt me.', pushback: 'How do I know it will be different next time?', hint: 'Acknowledge the impact, explain what you will change, and leave room for the other person to respond.' }
  ],
  reviewPrompts: [
    { id: 'worked', title: 'What helped this week?', placeholder: 'A small win, a supportive person, or a routine that helped…' },
    { id: 'difficult', title: 'What felt difficult?', placeholder: 'What asked more of you than expected?' },
    { id: 'learned', title: 'What do you want to carry forward?', placeholder: 'Something you learned about your needs or limits…' },
    { id: 'next', title: 'One manageable priority for next week', placeholder: 'Choose a small action you can actually make room for…' },
    { id: 'support', title: 'What support or rest will you make room for?', placeholder: 'Who or what could make next week easier?' }
  ]
};
