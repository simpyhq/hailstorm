const QUOTES = [
  { text: "The investor's chief problem — and even his worst enemy — is likely to be himself.", author: "BENJAMIN GRAHAM" },
  { text: "Risk comes from not knowing what you're doing.", author: "WARREN BUFFETT" },
  { text: "In investing, what is comfortable is rarely profitable.", author: "ROBERT ARNOTT" },
  { text: "The stock market is a device for transferring money from the impatient to the patient.", author: "WARREN BUFFETT" },
  { text: "Compound interest is the eighth wonder of the world. He who understands it, earns it; he who doesn't, pays it.", author: "ALBERT EINSTEIN" },
  { text: "It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong.", author: "GEORGE SOROS" },
  { text: "The four most dangerous words in investing are: 'this time it's different.'", author: "JOHN TEMPLETON" },
  { text: "The man who does not read has no advantage over the man who cannot read.", author: "MARK TWAIN" },
  { text: "Success is not final, failure is not fatal: It is the courage to continue that counts.", author: "WINSTON CHURCHILL" },
  { text: "The best investment you can make is in yourself.", author: "WARREN BUFFETT" },
  { text: "He who has a why to live can bear almost any how.", author: "NIETZSCHE" },
  { text: "Wealth consists not in having great possessions, but in having few wants.", author: "EPICTETUS" },
  { text: "First say to yourself what you would be; and then do what you have to do.", author: "EPICTETUS" },
  { text: "We suffer more in imagination than in reality.", author: "SENECA" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "SENECA" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "CHINESE PROVERB" },
  { text: "Price is what you pay. Value is what you get.", author: "WARREN BUFFETT" },
  { text: "An investment in knowledge pays the best interest.", author: "BENJAMIN FRANKLIN" },
  { text: "Wide diversification is only required when investors do not understand what they are doing.", author: "WARREN BUFFETT" },
  { text: "The secret of getting ahead is getting started.", author: "MARK TWAIN" },
];

function getDailyQuote() {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return QUOTES[dayIndex % QUOTES.length];
}

export function initQuote() {
  const textEl = document.getElementById("quote-text");
  const authorEl = document.getElementById("quote-author");
  if (!textEl || !authorEl) return;

  const quote = getDailyQuote();
  textEl.textContent = `"${quote.text}"`;
  textEl.classList.remove('skeleton');
  authorEl.textContent = `— ${quote.author}`;
  authorEl.classList.remove('skeleton');
}
