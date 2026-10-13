# nanboku-lcd1602

仙台市営地下鉄**南北線のアナウンス文**に出る文字(漢字96・ひらがな39・カタカナ6・記号1、計142種)を、
LCD1602(I2C)に表示する micro:bit(MakeCode)用ライブラリです。
東雲フォント16x16を 3マス x 2段に縮小して CGRAM に登録して表示します。

データは約4.4KBと小さく、**micro:bit V1 でも動きます**。

## 使い方

MakeCode の「拡張機能」に次のURLを入れます。

`https://github.com/nori-pixl/pxt-nanboku-lcd1602`

```typescript
nanbokuLCD.init(0x27)                      // アドレスは 0x27 か 0x3F
nanbokuLCD.showStation(8, 0, 700)          // 8番目の駅(仙台)を1文字ずつ表示
nanbokuLCD.showText("N08", 8, 0)           // 英数字は通常の文字で
nanbokuLCD.showSequence("まもなく仙台", 0, 700)
```

駅番号は 1=富沢 〜 17=泉中央 です(アナウンス文の並び順)。

## 制約

- 同時に表示できる全角文字は**1文字**です(CGRAM 8個のうち6個を使用)。
- 収録外の文字は何も表示しません。任意の漢字が必要なら、汎用版を使ってください。
  https://github.com/nori-pixl/pxt-kanji-lcd1602

## 文字を作り直す

```bash
python tools/make_font.py tools/shnmk16.bdf                 # tools/namboku.txt の文字から nanbokufont.ts を再生成
python tools/make_font.py tools/shnmk16.bdf --text 別.txt    # 別のテキストの文字にする
```

## ライセンス

MIT。フォントデータは東雲フォント(パブリックドメイン)由来です。
