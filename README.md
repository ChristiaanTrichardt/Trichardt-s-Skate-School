# Skate Skool

A punk-rock skater digital classroom. Each class gets its own page and join code. Units hold notes, files (PDF, Word, PowerPoint, images, video), YouTube videos and links, and each unit can have its own theme. Students earn coins from focus sessions and revision quizzes, then spend them on characters, headgear, pets, plants and gear for their hangout.

- **Website:** static files hosted free on GitHub Pages.
- **Database, logins and file uploads:** a free Supabase project.
- **Students** log in with class code + skater name + a 4-number PIN (no email needed).
- **You** log in with email + password.

Setup takes about 20 minutes, once.

---

## 1. Create the database (Supabase)

1. Go to **supabase.com** → sign up → **New project**. Pick any name, set a database password (save it somewhere), and choose the **Sydney** region.
2. When the project is ready, open **SQL Editor** (left sidebar) → **New query**.
3. Open `supabase/setup.sql` from this folder, copy everything, paste it in, and press **Run**. You should see "Success".
4. Go to **Authentication → Sign In / Providers** (may be called **Providers**) and turn on **Allow anonymous sign-ins**. Save. *(This is how students log in without an email.)*
5. Click the **Connect** button at the top of your project dashboard, pick any framework tab, and copy two things from the lines it shows:
   - **Project URL**: the `https://abcdxyz.supabase.co` part of the `..._SUPABASE_URL=` line
   - **Publishable key**: everything after `=` on the `..._PUBLISHABLE_KEY=` (or `..._ANON_KEY=`) line

   The key is also under **Project Settings → API Keys**. Never use the *secret* key. If you can't find the URL, it's `https://` + the project ID shown in your browser's address bar after `/project/` + `.supabase.co`.

## 2. Add your keys to the website

Open `js/config.js` and paste the two values in place of the placeholders:

```js
window.SKATE_CONFIG = {
  SUPABASE_URL: 'https://abcdxyz.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_...',
};
```

This key is designed to be public. The rules in `setup.sql` control what anyone can do.

## 3. Put the site on GitHub Pages

1. On **github.com**, click **+ → New repository**. Name it (e.g. `skate-skool`), set it to **Public**, and click **Create repository**.
   GitHub Pages is free for public repositories. Only the website code is public; class data lives in Supabase behind logins.
2. On the new repo page, click **uploading an existing file**. Drag in **everything inside this folder**: `index.html`, `.nojekyll`, `README.md`, and the `css`, `js` and `supabase` folders. Then click **Commit changes**.
3. Go to the repo's **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch to **main** and folder to **/ (root)**, then **Save**.
4. After a minute or two, the page shows your site address, e.g. `https://yourname.github.io/skate-skool/`.

Then go back to Supabase → **Authentication → URL Configuration**:

- Set **Site URL** to your GitHub Pages address.
- Add the same address under **Redirect URLs**.

This makes the email confirmation link bring you back to your site.

## 4. Create your teacher login

1. Visit your site with `#teacher` on the end, e.g. `https://yourname.github.io/skate-skool/#teacher`.
2. Enter your email and a password, then press **Create teacher account**. Confirm the email Supabase sends you, then sign in.
3. The site will say your account isn't activated yet and show you one line of SQL. Run that line in Supabase's **SQL Editor**:

   ```sql
   insert into public.teachers (user_id) select id from auth.users where email = 'you@school.edu.au';
   ```

4. Press **I've done it, check again**. You're in.

## 5. Use it

1. **Make a class.** It gets a join code automatically.
2. **Add units**, and pick a theme for each.
3. **Add resources** to each unit: files, YouTube videos, links or notes.
4. **Make revision quizzes.** Paste many questions at once with this format:

   ```
   Q: What is the chemical symbol for sodium?
   * Na
   - So
   - S
   ```

5. **Share the site address and the join code** with your class. Students tap **I'm new**, type the code, pick a skater name and a 4-number PIN, and drop in.
6. **On a new device**, students use **I've been here before** with the same code, name and PIN.
   - If they forget their PIN, set a new one in the class's **Skaters** tab.
   - 10 wrong PINs locks the account until you reset it.

---

## Changing things

- **Coin rules:** go to **Settings** on the site. You can change the welcome bonus, coins per focus minute, and the daily limits.
- **Shop prices and names:** in Supabase, go to **Table Editor → shop_items** and edit the cells.
- **Your own themes:** use the **Themes** page on the site.
- **Built-in themes:** edit the `THEMES` list at the top of `js/art.js`, then upload the changed file to GitHub.
- **Give or take coins:** use the class's **Skaters** tab.

## Good to know

- **Coins can't be faked.** Coins are awarded by the database, not the browser:
  - Focus sessions only pay out after the full time has passed.
  - Quizzes are marked on the server, and pay coins once per quiz per day.
  - There are daily coin limits.
- **Students only see their own classes.** They see only classes they've joined, never units you've hidden, and never other students' PINs. The leaderboard shows skater names only.
- **Uploaded files are public links.** Anyone who has a file's exact web address can open it, although the address is long and random. Don't upload anything confidential.
- **Free Supabase projects pause after about a week with no visitors** (e.g. school holidays). If the site stops loading, open your Supabase dashboard and click **Restore project**.
- **Storage limits:** the free tier holds 1 GB of files, with each upload capped at 50 MB. For larger videos, put them on YouTube or OneDrive and add a link.
