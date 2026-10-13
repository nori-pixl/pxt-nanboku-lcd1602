// 南北線の駅名を順に表示する例
nanbokuLCD.init(0x27)
for (let i = 1; i <= nanbokuLCD.stationCount(); i++) {
    nanbokuLCD.clear()
    nanbokuLCD.showStation(i, 0, 700)
    basic.pause(500)
}
