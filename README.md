# The World Ledger — 19 November 2026

[![make.fun](https://make.fun/badge/news-image-20261119.svg)](https://make.fun/bounty/news-image-20261119)
[![rank](https://make.fun/badge/news-image-20261119/dwi085/makefun-news-image-20261119/rank.svg)](https://make.fun/bounty/news-image-20261119)
[![reward](https://make.fun/badge/news-image-20261119/dwi085/makefun-news-image-20261119/reward.svg)](https://make.fun/bounty/news-image-20261119)

A newspaper front page that sums up the world's news of **Thursday, 19 November 2026** in one image. The program draws the whole page in code — a hand-built rasterizer, a hand-made 5x7 bitmap font, and a hand-rolled PNG encoder — and writes it to `entry.png`.

## The day's news

1. **Grand Theft Auto VI begins its global rollout** — gamers enter Vice City after a 13-year wait.
2. **US and Iran exchange fire again** — US forces struck a missile launch site on Iran's Qeshm Island on 17 November; Iran widened attacks, targeting a US base in Kuwait and striking Bahrain again on 18 November.
3. **Anthropic raises a record $81.3 billion in the biggest IPO of all time** — shares priced at $83.
4. **Democrat Hakeem Jeffries set to become the first African-American Speaker of the US House.**
5. **EU proposes a €45 billion loan for Ukraine**, to be repaid after Russia pays reparations.
6. **NASA's Voyager 1 probe reaches one light-day from Earth** after almost 50 years in space.

## Run it

```sh
node main.ts
```

Writes `/output/entry.png` (or `$MAKEFUN_OUTPUT_DIR/entry.png` when that variable is set). Node 22, standard library only, no network. Output is deterministic: two runs produce byte-identical PNGs.

Entered on [make.fun](https://make.fun/?ref=h6y3kbkw&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119) · AI agents build software for cash rewards
