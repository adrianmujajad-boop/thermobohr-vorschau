# Quellen der v004

Die vollständigen Bibliotheks-Repositories liegen ausschliesslich in der gemeinsamen lokalen Referenzablage `Projekte/Skills/repositories`. Dieses Projekt enthält nur die tatsächlich verwendeten Komponenten als Teil der Website.

- daisyUI 5.7.50, `saadeghi/daisyui`, Commit `bf3bac3a397b543e55641ecb2d60a2ed961f09ec`, MIT. Der vorgebaute Button aus dem gleichversionierten npm-Paket wird auf `#ending-panel` begrenzt. Keine globalen Themes oder Resets. Quelle: https://github.com/saadeghi/daisyui
- React Bits, `DavidHDev/react-bits`, Commit `e12c22192ac7b4b452c5e2feb9b586d74765d696`, `src/content/Animations/FadeContent/FadeContent.jsx`, unverändert übernommen. MIT + Commons Clause; Originaltext in `licenses/react-bits-LICENSE.md`. Einbindung als Teil dieser Website. Quelle: https://github.com/DavidHDev/react-bits
- Motion Primitives, `ibelick/motion-primitives`, Commit `120f64f6ca60348e251f929e9c81f11ccbe45eda`, `components/core/text-effect.tsx`, MIT. Ausschliesslich der Aliasimport für `cn` wurde auf den lokalen Helfer angepasst. Quelle: https://github.com/ibelick/motion-primitives

Die Laufzeitabhängigkeiten React, React DOM, Scheduler, Motion, Framer Motion, Motion DOM, Motion Utils und clsx sind im Bundle enthalten; ihre mitgelieferten Lizenztexte liegen in `licenses/`. GSAP 3.14.2 und ScrollTrigger werden von React Bits FadeContent verwendet. Die vom npm-Paket genannte Lizenz ist `Standard 'no charge' license: https://gsap.com/standard-license.` Die vom Bundler erhaltenen Original-Copyright- und Lizenzhinweise stehen zusätzlich in `ending-app.js.LEGAL.txt`. `package-lock.json` fixiert die verwendeten npm-Stände.

Logo, Originalfoto und das aus der Projektvorlage angenäherte Rotomax-Modell stammen aus den bestehenden Projektdateien. Die Bibliotheksverweise bestätigen keine exakte technische Nachbildung des Geräts.

Die alternative DTH-Kopfform wurde anhand des Epiroc-DTH-Produktkatalogs (gedruckte S. 16, TD40 Flat-front 130 mm, Produkt 90516007) schematisch neu konstruiert. Referenz: https://www.epiroc.com/content/dam/epiroc/rock-drilling-tools/documents/Epiroc%20DTH%20product%20catalog.pdf. Es wurden keine Herstellerbilder oder CAD-Dateien übernommen. Die Zuordnung zum Kunden-Rotomax ist nicht bestätigt.
