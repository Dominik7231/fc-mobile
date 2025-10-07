 diff --git a/README.md b/README.md
index 385be73c10f46fcaa41049409953f83d8b25c5e9..d53ff937fc523b6b12ce95cf28b035002ab8c959 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,36 @@
-# fc-mobile
+# 2D 11v11 Focis Játék
+
+Ez egy egyszerű, böngészőben futó 2D-s focis játék. A projekt teljesen statikus fájlokból (HTML, CSS és JavaScript) áll, ezért a futtatáshoz nincs szükség külön build folyamatra vagy backendre.
+
+## Helyi futtatás
+
+1. Klónozd vagy töltsd le a repót.
+2. Nyisd meg terminálban a projekt mappáját.
+3. Indíts egy egyszerű statikus szervert, például az alábbi Node.js alapú parancs valamelyikével:
+   ```bash
+   npx serve .
+   # vagy
+   npx http-server .
+   ```
+   (Használhatsz bármilyen más eszközt is, ami statikus fájlokat szolgál ki.)
+4. A böngészőben nyisd meg az eszköz által kiírt URL-t (általában <http://localhost:3000> vagy <http://127.0.0.1:8080>). Az `index.html` automatikusan betölti a játékot.
+
+> **Miért nem működik egyszerű fájlmegnyitással?**
+> A legtöbb böngésző nem engedélyezi, hogy `file://` protokollról betöltött oldalak JavaScript kódból más fájlokat olvassanak. Ezért közvetlenül megnyitva az `index.html`-t a fizika és az erőforrások nem töltődnek be. Egy minimális statikus webszerverrel ez a korlátozás nem áll fenn.
+
+## Megjelenítés GitHubon
+
+A kód GitHubon önmagában nem "fut", mert a repository csak a forrásfájlokat tárolja. A böngészőben való kipróbáláshoz a legkényelmesebb megoldás a GitHub Pages:
+
+1. A GitHubon a repository beállításai között keresd meg a **Pages** menüt.
+2. Állítsd be a forrást `main` branchre és a gyökérmappára (`/`).
+3. Mentsd el a beállítást. Pár perc múlva a GitHub biztosít egy publikus URL-t, ahol a játék elérhető lesz.
+
+Alternatívaként a fenti „Helyi futtatás” lépéseket követve saját gépen is elindíthatod.
+
+## Irányítás
+
+- Mozgás: `W`, `A`, `S`, `D`
+- Lövés / passz: `Space`
+
+A pálya tetején található eredményjelző mutatja a hátralévő időt és a gólokat.
