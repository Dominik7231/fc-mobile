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
- Lövés: `A`
- Precíz passz: `B`
- Sprint: `RT`
- Legközelebbi játékos átvétele: `LB`

A kontroller és a billentyűzet párhuzamosan is használható; a játék automatikusan a legutóbbi bemenetet veszi figyelembe.

A pálya tetején található eredményjelző mutatja a hátralévő időt és a gólokat, a verziószám, valamint a birtoklási mérő az aktuális mérkőzés állapotáról ad visszajelzést, míg az állóképesség-csík segít nyomon követni, hogy meddig tartható a sprintelés.

## Újdonságok a v1.5.0-ban

- Bedobások, kirúgások és szögletek automatikusan hozzák vissza a labdát a pályára, így az sosem akad a vonalon kívül.
- A labdakezelés finomabb: a felhasználó irányította játékos közel tartja a labdát, miközben az AI lövései realisztikusabban pattannak le.
- A csapatok taktikája az állás és az idő függvényében módosul, hátrányban agresszívebben támadnak, előnyben visszazárnak.
- A HUD továbbra is mutatja az állóképességet, birtoklást és az aktuális verziószámot, immár v1.5.0 jelöléssel.

## Újdonságok a v1.4.0-ban

- A játékosok már nem léphetnek a vonalakon kívülre: a mesterséges intelligencia és a felhasználó által irányított labdarúgók is a játéktéren belül maradnak.
- Xbox Series kontroller támogatás, beleértve a sprintet, passzt, lövést és gyors játékosváltást.
- Új birtoklási mérő, amely valós időben számolja és kijelzi a két csapat labdabirtoklási arányát.
- Finomhangolt csapatjáték: a védekező egység kijelölt üldözői támadják a labdát, miközben a támadók birtokláskor mélyebb futásokat indítanak.
- A HUD mostantól verziószámot jelenít meg, így könnyebb követni, melyik kiadással játszol.
