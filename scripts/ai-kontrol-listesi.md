# Yapay zeka kontrol listesi (yazılı + sesli)

Her büyük değişiklikten sonra bu soruları yeni sohbette sor. "Beklenen" 12 Ekim 2026 itibarıyla veritabanından alınmıştır;
veri değişince beklenen değer de değişir (aşağıdaki SQL ile yeniden hesaplanır).

| # | Soru | Beklenen |
|---|------|----------|
| 1 | USD borçlarım ne kadar? Hepsini say | Toplam 310.835,60 USD; Berinvest 115.789,78, Haitian 100.000, Murat Özdemir-SPS 53.500, Alya-SPS 29.890, Taizhou 10.850 |
| 2 | EUR borçlarım | 5.760,82 EUR (Ambiente Fuar 5.750) |
| 3 | SPS carisi | 3 kart: TED-0014 (14.400 TL, 0,44 USD), TED-0146 Alya 29.890 USD, TED-0147 Murat Özdemir 53.500 USD; USD toplamı 83.390,44 |
| 4 | İç mekan USD alacaklarım | 6 cari, toplam 48.595,31 USD (Adeon 6.629,89, GML 7.173,80, Ahmet Çiftçi 26.432,87, Ay Silikon 6.879,42, Selim Abi 1.446,10, Hadar 33,23) |
| 5 | İç mekan ve dış mekan cari ekstresi Excel ver | Excel: Dış Mekan (141 cari) ve İç Mekan sayfaları, toplam satırlı |
| 6 | Dış mekan cariler net bakiye | 4.401.348,93 TL |
| 7 | Eylül ayı iç mekan satış adedi ve hammadde | 25.594 adet, 1.038.746 TL (iadeler eksi, 10 satır); cevap "yalnız Eylül" demeli |
| 8 | İlk 9 ay iç mekan / dış mekan satış adedi | iç 1.105.958, dış 9.822 (ürün satırı sayısı 1250 olduğundan 1000 sınırı aşılmamalı) |
| 9 | Dış mekan satış ve hammadde Excel ver | Ürün Adı / Satış Adedi / Gramaj / Hammadde kg / Tutar sütunları, hammadde kg büyükten küçüğe, toplam satırı |
| 10 | Kaç cari ünvan var | 431 (müşteri 285, tedarikçi 143, diğer 3; 2 yeni SPS kartı dahil) |

## Beklenen değerleri yeniden hesaplamak için SQL

```sql
select
 (select round(-sum(bakiye_usd) filter (where bakiye_usd<0),2) from cari_hesaplar) usd_borc,
 (select round(-sum(bakiye_eur) filter (where bakiye_eur<0),2) from cari_hesaplar) eur_borc,
 (select round(sum(bakiye_usd),2) from cari_hesaplar where (muhasebe_kodu like '120.01%' or muhasebe_kodu like '120.02%') and bakiye_usd>0) ic_usd_alacak,
 (select round(sum(bakiye),2) from cari_hesaplar where muhasebe_kodu like '120.03%') dis_net_tl,
 (select round(sum(adet)) from satis_adetleri where ay=9 and mekan='ic') eylul_ic_adet,
 (select round(sum(adet)) from satis_adetleri where mekan='dis') dis_9ay_adet,
 (select round(sum(adet)) from satis_adetleri where mekan='ic') ic_9ay_adet,
 (select count(*) from cari_hesaplar) cari_sayisi;
```

Sesli asistanda: oturumu kapatıp yeniden aç, aynı soruları konuşarak sor. Excel istenince ekranda "Excel indir" düğmesi çıkmalı.
