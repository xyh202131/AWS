# NBA中国选秀页抓取报告

- Source: NBA中国官方网站 | 选秀大会
- URL: https://china.nba.cn/draft/
- Scrape date: 20260623
- Raw markdown: data/raw/china-nba-draft-20260623.md
- Raw links: data/raw/china-nba-draft-links-20260623.json
- Normalized JSON: data/normalized/normalized_china_nba_draft_board_20260623.json

## Result

- Total pick/order rows: 60
- First round rows: 30
- Second round rows: 30
- Rows with player names: 3
- Linked player detail pages scraped: 3
- Player detail pages with additional profile fields: 0

## Data Notes

- Picks 1-3 include player names, positions, schools, height, and listed weight from the draft table.
- Picks 4-60 currently provide team/order/trade context but no player identity in the scraped page.
- The player detail URLs resolved to the same draft-board shell in this scrape; they did not expose additional player biography fields.
- This source should be treated as a live NBA China page snapshot and compared against NBA.com official US sources before changing any locked prediction output.
