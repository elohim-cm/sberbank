# Inscription et tableau de bord avec MongoDB Atlas

Pour les e-mails transactionnels, voir [la configuration Brevo](BREVO-SETUP.md).

Le serveur Next.js enregistre les profils dans Atlas. Le navigateur ne reçoit
jamais la chaîne de connexion. Aucune base de données locale supplémentaire
n'est nécessaire.

## Configuration

Dans `.env.local` (ignoré par Git) :

```dotenv
DATABASE_MONGODB_URI=votre_connexion_atlas
MONGODB_DB=bank
```

`MONGODB_URI` est également accepté. `MONGODB_DB` est optionnel et vaut `bank`
par défaut. Les collections `accounts` et `sessions`, l'index unique des e-mails
et l'index d'expiration des sessions sont créés automatiquement.

Sur Vercel, définir les mêmes variables côté serveur dans les environnements
concernés, puis redéployer. `.env.local` n'est pas envoyé par `git push`.
Le compte technique Atlas doit pouvoir lire/écrire et créer les index dans la
base choisie ; l'accès réseau Atlas doit autoriser l'environnement d'exécution.

Si le DNS local refuse les recherches SRV (`querySrv ECONNREFUSED`), une variable
optionnelle `MONGODB_DNS_SERVERS` peut désigner un résolveur explicitement autorisé,
par exemple `1.1.1.1`. Elle ne change que le résolveur DNS du processus Node.js.
Ne pas la recopier sur Vercel si son résolveur fonctionne normalement.

## Parcours

- L'inscription valide les champs côté navigateur et côté serveur.
- Un succès n'est affiché qu'après validation de la transaction Atlas qui crée
  le compte et sa session. Une adresse e-mail déjà utilisée est refusée.
- La session utilise un cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production,
  valable sept jours. Seule l'empreinte du jeton est enregistrée dans Atlas.
- Le tableau de bord relit le profil de la session dans Atlas à chaque navigation
  serveur/rechargement. Les paramètres d'URL ne permettent pas de choisir un
  autre compte ou de changer le produit enregistré.
- La déconnexion révoque la session ; elle ne supprime pas le compte.
- Chaque compte possède un champ numérique `balance`, initialisé à `0`, exprimé
  en roubles. Le modifier dans `bank.accounts` permet de changer le solde relu
  par le serveur au prochain rechargement. Ce champ n'est jamais accepté depuis
  le formulaire d'inscription. Les restrictions d'affichage avant validation du
  KYC restent actives, même lorsqu'un solde est renseigné.
- La récupération de compte et la connexion depuis un autre navigateur restent
  à implémenter. L'onglet « Вход » reprend uniquement une session existante.
- Le KYC utilise `kyc_requests` et `kyc_files`. Les documents sont enregistrés
  comme brouillon, puis le client capture ou sélectionne son selfie. Le statut
  passe à `pending` dans une transaction uniquement lorsque toutes les photos
  obligatoires sont présentes : recto/verso et selfie pour carte/permis, page
  d'identité et selfie pour passeport. Aucun contrôle biométrique automatique
  ni décision d'approbation n'est effectué.
- Chaque image est envoyée séparément (3 Mo maximum après préparation côté
  navigateur ; origine limitée à 10 Mo). Le serveur vérifie et réencode les
  images, supprime les métadonnées EXIF et conserve les octets dans MongoDB.
  Les fichiers ne sont jamais enregistrés dans `public` ou sur le disque Vercel.
- `/api/account/kyc/files/[id]` permet uniquement au propriétaire connecté de
  relire sa photo. L’espace `/sberbank/admin` permet d’examiner, télécharger et
  approuver les dossiers avec un accès distinct : voir [ADMIN-SETUP.md](ADMIN-SETUP.md).
- La caméra utilise HTTPS (ou localhost), demande une permission explicite dans
  le navigateur et s'arrête à la capture ou à la fermeture de l'étape. Un champ
  de capture/sélection de photo est disponible si la caméra n'est pas accessible.

## Vérification réelle

Démarrer le site sur le port 3000, puis :

```sh
node tests/atlas-registration.mjs
node tests/atlas-kyc.mjs
```

Le test crée deux profils synthétiques uniques, vérifie tous les champs dans
Atlas, contrôle leur restitution dans le tableau de bord, l'isolation des comptes,
la validation et la déconnexion. Il supprime uniquement ses propres comptes et
sessions à la fin. Il ne doit jamais être exécuté avec des données personnelles
réelles à la place des données de test intégrées.
