# LGDP APP — PRD

## Vision
Application mobile officielle de **Les Gars du Podcast (LGDP)**, une organisation québécoise combinant podcast de lutte, fédération de lutte indépendante, événements live, billetterie et boutique. Inspiré de WWE Network + UFC Fight Pass + Spotify + Ticketmaster.

## MVP Delivered (V1)
- ✅ Authentification: JWT email/password + Google (Emergent-managed)
- ✅ Page **Accueil**: bannière hero cinématique, nouvelles, événements à venir, dernier podcast
- ✅ Module **Lutte**: Roster lutteurs (grid), Matchs (à venir + résultats), Championnats
- ✅ Module **Podcast**: liste épisodes, écran de lecture, mini-player global, favoris, partage, lecture en arrière-plan (expo-audio)
- ✅ Module **Billets**: liste événements, checkout bottom-sheet, paiement **Square MOCKÉ**
- ✅ Module **Boutique**: grille produits + catégories filtrables, détail plein écran, achat **Square MOCKÉ**
- ✅ **Profil**: infos user, billets achetés (placeholder QR), commandes, favoris épisodes
- ✅ Contenu de démo québécois (6 lutteurs, 5 épisodes, 3 événements, 6 produits, 4 news)
- ✅ Auto-seed au premier démarrage

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Toutes routes préfixées `/api`.
- **Frontend**: Expo Router (React Native 0.81 / Expo SDK 54).
- **Audio**: `expo-audio` avec `shouldPlayInBackground: true`.
- **Auth**: JWT (bcrypt hash) OU token session Emergent — tokens interchangeables via header `Authorization: Bearer`.

## Design
- Mode sombre profond (#0D0E12) + rouge intense (#E52321) + or championnat (#D4AF37).
- Typo: display condensé bold (Impact / sans-serif-condensed) + body système.
- Grands visuels cinématiques, scrims gradient, cartes premium, boutons impactants.

## À venir (V2+)
- Intégration **Square réelle** (Application ID + Access Token requis)
- Billet numérique avec **QR code réel** + scanner d'entrée
- Système membre **VIP** et contenu exclusif
- **Push notifications** Emergent-managed (architecture prête)
- Statistiques admin avancées, panneau admin complet UI
- Uploads audio/images côté admin

## Business Enhancement (V1.5)
Ajouter un **système d'abonnement VIP LGDP** (revenus récurrents): accès anticipé billets 24h avant, épisodes bonus, réduction 15% sur toute la boutique. Génère du revenu prévisible entre les shows.
