/**
 * 仙台市営地下鉄南北線のアナウンス文に出る文字(142種)を LCD1602(I2C)に表示するライブラリ。
 * 東雲フォント16x16を 3x2マス(15x16ドット)に縮小し、CGRAM 0〜5 に登録して表示する。
 * 同時に表示できる全角文字は1文字。CGRAM 6,7 は使わないので他の用途に使える。
 * 収録: 南北線のアナウンス文に出る漢字・ひらがな・カタカナ 142種(データ約4.4KB)
 */
//% weight=90 color=#2E86AB icon="\uf238" block="南北線LCD"
namespace nanbokuLCD {
    let addr = 0x27
    let backlight = 0x08
    let customCodes: number[] = []
    let customBufs: Buffer[] = []
    let nextPos = 0

    // ---------- 低レベルI2C ----------
    function wr(v: number) {
        pins.i2cWriteBuffer(addr, pins.createBufferFromArray([v | backlight]))
    }
    function nib(v: number, rs: number) {
        wr((v & 0xF0) | rs | 0x04)
        wr((v & 0xF0) | rs)
    }
    function send(v: number, rs: number) {
        nib(v, rs)
        nib(v << 4, rs)
    }

    // ---------- 文字コード ----------
    // 文字列の i 番目の文字のUnicodeコードを返し、次の位置を nextPos に入れる。
    // MakeCodeの版によって charCodeAt が文字単位でもUTF-8のバイト単位でも動くようにしている。
    function codeAt(text: string, i: number): number {
        let c = text.charCodeAt(i)
        nextPos = i + 1
        if (c >= 0xE0 && c <= 0xEF && i + 2 < text.length) {
            let c1 = text.charCodeAt(i + 1)
            let c2 = text.charCodeAt(i + 2)
            if (c1 >= 0x80 && c1 <= 0xBF && c2 >= 0x80 && c2 <= 0xBF) {
                nextPos = i + 3
                return ((c & 0x0F) << 12) | ((c1 & 0x3F) << 6) | (c2 & 0x3F)
            }
        }
        return c
    }

    function hexVal(c: number): number {
        return c <= 57 ? c - 48 : (c <= 70 ? c - 55 : c - 87)
    }

    // 組み込みデータの中から code を二分探索する。無ければ -1
    function findIndex(code: number): number {
        let lo = 0
        let hi = GLYPH_COUNT - 1
        while (lo <= hi) {
            let mid = (lo + hi) >> 1
            let v = INDEX.getNumber(NumberFormat.UInt16BE, mid * 2)
            if (v == code) return mid
            if (v < code) lo = mid + 1
            else hi = mid - 1
        }
        return -1
    }

    // ---------- 表示 ----------
    function writeGlyph(buf: Buffer, base: number) {
        for (let c = 0; c < 6; c++) {
            let cx = c % 3
            let ry = c < 3 ? 0 : 1
            send(0x40 | (c << 3), 0)                       // CGRAM c
            for (let y = 0; y < 8; y++) {
                let pos = (ry * 8 + y) * 15 + cx * 5
                let byte = base + (pos >> 3)
                let v = buf.getUint8(byte) << 8
                if (byte + 1 < buf.length) v |= buf.getUint8(byte + 1)
                send((v >> (11 - (pos & 7))) & 31, 1)
            }
        }
    }

    function showCode(code: number, col: number): boolean {
        let k = customCodes.indexOf(code)
        if (k >= 0) {
            writeGlyph(customBufs[k], 0)
        } else {
            let idx = findIndex(code)
            if (idx < 0) return false
            writeGlyph(BLOCKS[idx / BLOCK_SIZE | 0], (idx % BLOCK_SIZE) * 30)
        }
        send(0x80 | col, 0)
        send(0, 1); send(1, 1); send(2, 1)                 // 上段
        send(0xC0 | col, 0)
        send(3, 1); send(4, 1); send(5, 1)                 // 下段
        return true
    }

    // ---------- ブロック ----------

    /**
     * LCDを初期化する。アドレスは 0x27 か 0x3F が多い。
     * @param address I2Cアドレス, eg: 39
     */
    //% blockId=nanboku_init block="南北線LCDを初期化 I2Cアドレス %address"
    //% address.defl=39
    //% weight=100
    export function init(address: number = 0x27) {
        addr = address
        basic.pause(50)
        nib(0x30, 0)
        basic.pause(5)
        nib(0x30, 0)
        nib(0x30, 0)
        nib(0x20, 0)
        send(0x28, 0)   // 4bit, 2行
        send(0x0C, 0)   // 表示ON
        send(0x06, 0)   // 右へ進む
        send(0x01, 0)   // クリア
        basic.pause(2)
    }

    /**
     * 画面を消す
     */
    //% blockId=nanboku_clear block="南北線LCD 画面を消す"
    //% weight=95
    export function clear() {
        send(0x01, 0)
        basic.pause(2)
    }

    /**
     * バックライトのオン/オフ
     */
    //% blockId=nanboku_bl block="南北線LCD バックライト %on"
    //% on.shadow=toggleOnOff on.defl=true
    //% weight=94
    export function setBacklight(on: boolean) {
        backlight = on ? 0x08 : 0x00
        wr(0)
    }

    /**
     * 漢字・ひらがな・カタカナを1文字表示する(3マス x 2段)。
     * @param ch 表示する文字(1文字), eg: "仙"
     * @param col 左端の桁(0〜13), eg: 0
     */
    //% blockId=nanboku_show block="南北線LCD 文字 %ch を 桁 %col に表示"
    //% ch.defl="仙" col.min=0 col.max=13 col.defl=0
    //% weight=90
    export function showKanji(ch: string, col: number) {
        if (ch.length == 0) return
        showCode(codeAt(ch, 0), col)
    }

    /**
     * 文字列を1文字ずつ切り替えて表示する。
     * @param text 文字列, eg: "仙台です"
     * @param col 左端の桁, eg: 0
     * @param ms 切り替え間隔(ミリ秒), eg: 800
     */
    //% blockId=nanboku_seq block="南北線LCD %text を 桁 %col に %ms ms ごとに順に表示"
    //% text.defl="仙台です" col.min=0 col.max=13 col.defl=0 ms.defl=800
    //% weight=85
    export function showSequence(text: string, col: number, ms: number = 800) {
        let i = 0
        while (i < text.length) {
            let code = codeAt(text, i)
            i = nextPos
            if (showCode(code, col)) basic.pause(ms)
        }
    }

    /**
     * 英数字(通常の文字)を表示する。
     * @param s 表示する文字列, eg: "12/31"
     * @param col 桁(0〜15), eg: 4
     * @param row 行(0または1), eg: 0
     */
    //% blockId=nanboku_text block="南北線LCD 英数字 %s を 桁 %col 行 %row に表示"
    //% s.defl="12/31" col.min=0 col.max=15 col.defl=4 row.min=0 row.max=1
    //% weight=80
    export function showText(s: string, col: number, row: number) {
        send((row == 0 ? 0x80 : 0xC0) | col, 0)
        for (let i = 0; i < s.length; i++) {
            send(s.charCodeAt(i), 1)
        }
    }

    /**
     * その文字が収録されているか調べる。
     */
    //% blockId=nanboku_has block="南北線LCD %ch は収録されている"
    //% ch.defl="仙"
    //% weight=70 advanced=true
    export function hasKanji(ch: string): boolean {
        if (ch.length == 0) return false
        let code = codeAt(ch, 0)
        return customCodes.indexOf(code) >= 0 || findIndex(code) >= 0
    }

    /**
     * 文字を自分で追加する(tools/make_font.py --extra で出る60桁の16進文字列)。
     * @param ch 文字1つ
     * @param hex 60桁の16進文字列
     */
    //% blockId=nanboku_reg block="南北線LCD 文字 %ch を登録 データ %hex"
    //% weight=60 advanced=true
    export function registerKanji(ch: string, hex: string) {
        if (ch.length == 0 || hex.length != 60) return
        let code = codeAt(ch, 0)
        let buf = pins.createBuffer(30)
        for (let i = 0; i < 30; i++) {
            buf.setUint8(i, hexVal(hex.charCodeAt(i * 2)) * 16 + hexVal(hex.charCodeAt(i * 2 + 1)))
        }
        let k = customCodes.indexOf(code)
        if (k >= 0) {
            customBufs[k] = buf
        } else {
            customCodes.push(code)
            customBufs.push(buf)
        }
    }

    const STATIONS = "富沢,長町南,長町,長町一丁目,河原町,愛宕橋,五橋,仙台,広瀬通,勾当台公園,北四番丁,北仙台,台原,旭ヶ丘,黒松,八乙女,泉中央"

    /**
     * 南北線の駅数(17)。
     */
    //% blockId=nanboku_count block="南北線の駅数"
    //% weight=75
    export function stationCount(): number {
        return STATIONS.split(",").length
    }

    /**
     * 駅名を返す。1=富沢 〜 17=泉中央。
     * @param n 駅番号(1〜17), eg: 1
     */
    //% blockId=nanboku_name block="南北線の駅名 %n"
    //% n.min=1 n.max=17 n.defl=1
    //% weight=74
    export function stationName(n: number): string {
        let list = STATIONS.split(",")
        if (n < 1 || n > list.length) return ""
        return list[n - 1]
    }

    /**
     * 駅名を1文字ずつ順に表示する。
     * @param n 駅番号(1〜17), eg: 8
     * @param col 左端の桁, eg: 0
     * @param ms 切り替え間隔(ミリ秒), eg: 700
     */
    //% blockId=nanboku_station block="南北線LCD 駅 %n を 桁 %col に %ms ms ごとに順に表示"
    //% n.min=1 n.max=17 n.defl=8 col.min=0 col.max=13 col.defl=0 ms.defl=700
    //% weight=88
    export function showStation(n: number, col: number, ms: number = 700) {
        showSequence(stationName(n), col, ms)
    }
}
