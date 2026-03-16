# Text-to-Image Post

> **⚠️ Card text ≠ body text — they MUST be written separately!**
> - **`-b` (body file)** = text rendered ON the image cards (`text_content`). Separate cards with **blank lines**. Max 3 cards.
> - **`-c` (parameter)** = text displayed BELOW the images (`content`). Typically a summary or engagement prompt.
> - Omitting `-c` makes body text identical to card text — **not intended behavior**.

```bash
cat > /tmp/post_body_$$.txt << 'BODYEOF'
First card content
3-6 lines ideal, include key points + data

Second card content
Continue the narrative; blank line = new card

Third card (optional)
Summary + engagement hook
BODYEOF

folder=$(bash ~/.openclaw/scripts/submit-to-publisher.sh \
  -a bot7 -t "标题" -b /tmp/post_body_$$.txt \
  -m text_to_image -r "direct:ou_xxx" \
  -T "A股,投资" \
  -s "基础" \
  -c "Body text below images, different from card text. E.g.: 你怎么看？欢迎评论区聊聊～")
echo "FOLDER: $folder"
```

`image_style` options: `基础` (default), `光影`, `涂写`, `书摘`, `涂鸦`, `便签`, `边框`, `手写`, `几何`
