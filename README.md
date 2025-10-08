# 2D 11v11 Focis Játék

Ez egy egyszerű, böngészőben futó 2D-s focis játék. A projekt teljesen statikus fájlokból (HTML, CSS és JavaScript) áll, ezért a futtatáshoz nincs szükség külön build folyamatra vagy backendre.

## Helyi futtatás

1. Klónozd vagy töltsd le a repót.
2. Nyisd meg terminálban a projekt mappáját.
3. Indíts egy egyszerű statikus szervert, például az alábbi Node.js alapú parancs valamelyikével:
   ```bash
   npx serve .
   # vagy
   npx http-server .
   ```
   (Használhatsz bármilyen más eszközt is, ami statikus fájlokat szolgál ki.)
4. A böngészőben nyisd meg az eszköz által kiírt URL-t (általában <http://localhost:3000> vagy <http://127.0.0.1:8080>). Az `index.html` automatikusan betölti a játékot.

> **Miért nem működik egyszerű fájlmegnyitással?**
> A legtöbb böngésző nem engedélyezi, hogy `file://` protokollról betöltött oldalak JavaScript kódból más fájlokat olvassanak. Ezért közvetlenül megnyitva az `index.html`-t a fizika és az erőforrások nem töltődnek be. Egy minimális statikus webszerverrel ez a korlátozás nem áll fenn.

## Megjelenítés GitHubon

A kód GitHubon önmagában nem "fut", mert a repository csak a forrásfájlokat tárolja. A böngészőben való kipróbáláshoz a legkényelmesebb megoldás a GitHub Pages:

1. A GitHubon a repository beállításai között keresd meg a **Pages** menüt.
2. Állítsd be a forrást `main` branchre és a gyökérmappára (`/`).
3. Mentsd el a beállítást. Pár perc múlva a GitHub biztosít egy publikus URL-t, ahol a játék elérhető lesz.

Alternatívaként a fenti „Helyi futtatás” lépéseket követve saját gépen is elindíthatod.

## Irányítás

### Billentyűzet

- Mozgás: `W`, `A`, `S`, `D`
- Lövés: `Space`
- Precíz passz a legjobb pozícióban álló csapattársnak: `F`
- Sprint: `Shift` (fogyasztja az állóképességet)
- Legközelebbi hazai játékos átvétele: `Q`

### Xbox Series kontroller

- Mozgás: bal analóg kar
- Precíz passz: `A` (vagy `X`)
- Lövés: `B` (vagy `Y`)
- Sprint: `RT` vagy `RB`
- Legközelebbi játékos átvétele: `LB`
- Menü nyitása / szünet: `Start` vagy `Menu`

### Telefon / tablet érintőképernyő

- Bal alsó sarokban található virtuális joystick: húzd az ujjad a kívánt irányba a mozgáshoz.
- Jobb alsó sarok gombjai: **Lövés**, **Passz**, **Sprint**, **Váltás**.
- Mobil böngészőkben a *Teljes képernyő* gomb natív módot kér, ellenkező esetben automatikusan ál-teljes képernyőre vált, hogy a pálya az egész kijelzőt kitöltse.

### Főmenü és szünet

- A játék induláskor a főmenüt jeleníti meg; innen indíthatsz új mérkőzést, folytathatod a szüneteltetettet vagy gyorsan újraindíthatod az aktuális meccset.
- Billentyűzeten az `Esc`, kontrolleren a `Start/Menu` gomb bármikor megnyitja vagy bezárja a szünet menüt.
- Asztali böngészőkben az `Enter` is elindíthatja a mérkőzést a főmenüből.

A kontroller és a billentyűzet párhuzamosan is használható; a játék automatikusan a legutóbbi bemenetet veszi figyelembe.

A pálya tetején található eredményjelző mutatja a hátralévő időt és a gólokat, a verziószám, valamint a birtoklási mérő az aktuális mérkőzés állapotáról ad visszajelzést, míg az állóképesség-csík segít nyomon követni, hogy meddig tartható a sprintelés. Az alsó sarokban megjelenő miniradar a teljes pálya helyzetét összegzi, a játékos előtt lebegő irányjelző pedig segít érezni, merre indul majd a lövés vagy passz.

## Újdonságok a v1.8.0-ban

- A labdavezetés folyamatos marad egészen addig, amíg az ellenfél el nem lopja: a passzok és lövések egyetlen gombnyomással azonnal elsülnek.
- Klasszikus Xbox kontroller kiosztás (`A` = passz, `B`/`Y` = lövés, `RT/RB` = sprint), valamint `Esc`/`Start` alapú szünetelés.
- Megújult főmenü, amely asztali és mobileszközön is könnyen kezelhető; innen érhető el a gyors újraindítás és a patch notes.
- Mobilbarát (ál)teljes képernyő mód: ha a böngésző nem támogatja a natív teljes képernyőt, a játék automatikusan kitölti a kijelzőt.
- Javítottuk a passz- és lövéslogikát, hogy a gombnyomások megbízhatóan reagáljanak, a játéktempó pedig kiegyensúlyozottabb legyen.

## Újdonságok a v1.7.0-ban

- Újratervezett labdakezelés: a játékos rövid kontroll-idővel engedi el a játékszert, így a passzok és lövések valóban elszállnak, mégis feszes marad a cselezés.
- Lassabb, taktikusabb tempó új sebesség- és súrlódási beállításokkal, hogy a mérkőzések olvashatóbbak legyenek.
- Teljes képernyős mód egyetlen gombnyomással, valamint érintéses HUD joystickkal és gombokkal mobileszközökön.
- Új irányjelző a felhasználó által irányított játékos előtt, ami megmutatja a következő passz/lövés várható irányát.
- Dokumentációs frissítések a mobil vezérlésről és a v1.7.0-s fejlesztésekről.

## Újdonságok a v1.6.0-ban

- Teljesen átdolgozott labdakezelés: a felhasználó vezérelt játékos stabilan a lába előtt tartja a labdát, így valódi cselezés és irányváltás is lehetséges, míg az AI lecsorgó labdái kiszámíthatóbb ívet kapnak.
- Minden pontrúgás gyorsan és automatikusan lezajlik – a rendszer kijelöli a végrehajtót, rögzíti a labdát, majd bedobás, kirúgás vagy szöglet után azonnal játékba hozza, akkor is, ha az ellenfél vitte ki a labdát.
- A gólvonal-ellenőrzés és a saját kapus gólok kezelése megbízhatóbb lett, így az öngólok is azonnal érvényes találatnak számítanak.
- Új, HUD-ra rajzolt miniradar segít előre látni a csapatok mozgását, hogy jobban tervezhető legyen a letámadás és az indítás.

## Újdonságok a v1.5.0-ban

- Bedobások, kirúgások és szögletek automatikusan hozzák vissza a labdát a pályára, így az sosem akad a vonalon kívül.
- A labdakezelés finomabb: a felhasználó irányította játékos közel tartja a labdát, miközben az AI lövései realisztikusabban pattannak le.
- A csapatok taktikája az állás és az idő függvényében módosul, hátrányban agresszívebben támadnak, előnyben visszazárnak.
- A HUD továbbra is mutatja az állóképességet, birtoklást és az aktuális verziószámot, immár v1.6.0 jelöléssel.

## Újdonságok a v1.4.0-ban

- A játékosok már nem léphetnek a vonalakon kívülre: a mesterséges intelligencia és a felhasználó által irányított labdarúgók is a játéktéren belül maradnak.
- Xbox Series kontroller támogatás, beleértve a sprintet, passzt, lövést és gyors játékosváltást.
- Új birtoklási mérő, amely valós időben számolja és kijelzi a két csapat labdabirtoklási arányát.
- Finomhangolt csapatjáték: a védekező egység kijelölt üldözői támadják a labdát, miközben a támadók birtokláskor mélyebb futásokat indítanak.
- A HUD mostantól verziószámot jelenít meg, így könnyebb követni, melyik kiadással játszol.
