-- ============================================================================
-- UltraDownloader V8.0 — High-Traffic XAMPP phpMyAdmin MySQL & MariaDB Database
-- Includes All 222 Active Platforms + High-Concurrency Composite Indexes
-- Import Steps in XAMPP:
--   1. Open XAMPP Control Panel -> Click [Start] on Apache & MySQL
--   2. Open http://localhost/phpmyadmin -> Click [Import] tab at top
--   3. Choose this file (ultradownloader_xampp.sql) -> Click [Import / Go]
-- ============================================================================

SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS `ultradownloader_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `ultradownloader_db`;

DROP TABLE IF EXISTS `security_audit_logs`;
DROP TABLE IF EXISTS `analytics_events`;
DROP TABLE IF EXISTS `share_links`;
DROP TABLE IF EXISTS `download_jobs`;
DROP TABLE IF EXISTS `encrypted_cookies`;
DROP TABLE IF EXISTS `seo_keywords`;
DROP TABLE IF EXISTS `finance_ledger`;
DROP TABLE IF EXISTS `saved_vault_videos`;
DROP TABLE IF EXISTS `system_settings`;
DROP TABLE IF EXISTS `ad_waterfall_zones`;
DROP TABLE IF EXISTS `platforms`;
DROP TABLE IF EXISTS `user_favorites`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `ip_lockouts`;
DROP TABLE IF EXISTS `admin_users`;
DROP TABLE IF EXISTS `websites`;

CREATE TABLE `websites` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `domain` VARCHAR(191) NOT NULL,
  `content_mode` VARCHAR(64) NOT NULL DEFAULT 'clean_mainstream',
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `monthly_revenue` DOUBLE NOT NULL DEFAULT 0,
  `monthly_expense` DOUBLE NOT NULL DEFAULT 0,
  `seo_score` INT NOT NULL DEFAULT 100,
  `created_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `admin_users` (
  `id` VARCHAR(64) PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `full_name` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `pin_hash` VARCHAR(255) NOT NULL,
  `totp_secret` VARCHAR(128) NOT NULL,
  `role` VARCHAR(64) NOT NULL DEFAULT 'super_admin',
  `last_login_at` VARCHAR(64) NULL,
  `created_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `ip_lockouts` (
  `ip_address` VARCHAR(64) PRIMARY KEY,
  `failed_attempts` INT NOT NULL DEFAULT 0,
  `banned_until` VARCHAR(64) NULL,
  `updated_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `users` (
  `id` VARCHAR(64) PRIMARY KEY,
  `full_name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `daily_quota` INT NOT NULL DEFAULT 500,
  `created_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `user_favorites` (
  `id` VARCHAR(64) PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `video_url` TEXT NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `thumbnail_url` TEXT NOT NULL,
  `platform_id` VARCHAR(64) NOT NULL,
  `duration_text` VARCHAR(64) NOT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  INDEX `idx_fav_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `platforms` (
  `id` VARCHAR(64) PRIMARY KEY,
  `display_name` VARCHAR(191) NOT NULL,
  `subtitle` VARCHAR(255) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `accent_color` VARCHAR(32) NOT NULL,
  `icon_key` VARCHAR(64) NOT NULL,
  `icon_svg` LONGTEXT NULL,
  `domains_json` LONGTEXT NOT NULL,
  `example_url` VARCHAR(500) NOT NULL,
  `seo_slug` VARCHAR(191) NOT NULL,
  `is_adult` TINYINT(1) NOT NULL DEFAULT 0,
  `supports_search` TINYINT(1) NOT NULL DEFAULT 0,
  `supports_online_player` TINYINT(1) NOT NULL DEFAULT 1,
  `supports_download` TINYINT(1) NOT NULL DEFAULT 1,
  `supports_resume` TINYINT(1) NOT NULL DEFAULT 1,
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `health_status` VARCHAR(32) NOT NULL DEFAULT 'operational',
  `known_limitations` TEXT NOT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  INDEX `idx_platforms_cat_enabled` (`category`, `is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `platforms` (`id`, `display_name`, `subtitle`, `category`, `accent_color`, `icon_key`, `icon_svg`, `domains_json`, `example_url`, `seo_slug`, `is_adult`, `supports_search`, `supports_online_player`, `supports_download`, `supports_resume`, `is_enabled`, `health_status`, `known_limitations`, `created_at`) VALUES
('facebook','Facebook','Public videos, Reels, Watch, Live','social','#2563EB','globe',NULL,'["facebook.com", "fb.watch", "fb.com"]','https://facebook.com/','facebook-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('instagram','Instagram','Reels, Stories, IGTV video','social','#0EA5E9','globe',NULL,'["instagram.com", "instagr.am"]','https://instagram.com/','instagram-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('tiktok','TikTok','No-watermark HD video & MP3','social','#6366F1','globe',NULL,'["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]','https://tiktok.com/','tiktok-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('youtube','YouTube','4K/8K video, Shorts, Live, MP3','social','#8B5CF6','globe',NULL,'["youtube.com", "youtu.be", "m.youtube.com"]','https://www.youtube.com/watch?v=WhWc3b3KhnY','youtube-4k-video-mp3-downloader',0,1,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('x_twitter','X (Twitter)','Videos, GIFs, Spaces audio','social','#EC4899','globe',NULL,'["x.com", "twitter.com", "t.co"]','https://x.com/','x-twitter-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('snapchat','Snapchat','Spotlight & story videos','social','#F43F5E','globe',NULL,'["snapchat.com", "t.snapchat.com"]','https://snapchat.com/','snapchat-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('threads','Threads','Threads videos & reels','social','#F97316','globe',NULL,'["threads.net", "threads.com"]','https://threads.net/','threads-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('pinterest','Pinterest','Video pins','social','#EAB308','globe',NULL,'["pinterest.com", "pin.it"]','https://pinterest.com/','pinterest-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('reddit','Reddit','v.redd.it video + audio','social','#22C55E','globe',NULL,'["reddit.com", "redd.it", "v.redd.it"]','https://reddit.com/','reddit-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('linkedin','LinkedIn','Public post videos','social','#14B8A6','globe',NULL,'["linkedin.com", "lnkd.in"]','https://linkedin.com/','linkedin-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('tumblr','Tumblr','Video posts','social','#06B6D4','globe',NULL,'["tumblr.com"]','https://tumblr.com/','tumblr-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('mastodon','Mastodon','Federated video posts','social','#64748B','globe',NULL,'["mastodon.social", "mastodon.online"]','https://mastodon.social/','mastodon-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('bluesky','Bluesky','Video posts','social','#2563EB','globe',NULL,'["bsky.app", "bsky.social"]','https://bsky.app/','bluesky-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('vk','VK','VK video 1080p','social','#0EA5E9','globe',NULL,'["vk.com", "vkvideo.ru"]','https://vk.com/','vk-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('weibo','Weibo','Weibo videos','social','#6366F1','globe',NULL,'["weibo.com", "weibo.cn"]','https://weibo.com/','weibo-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('wechat','WeChat','Channels video','social','#8B5CF6','globe',NULL,'["weixin.qq.com", "wechat.com"]','https://weixin.qq.com/','wechat-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('discord','Discord','Attachment CDN video','social','#EC4899','globe',NULL,'["discord.com", "discordapp.com", "cdn.discordapp.com"]','https://discord.com/','discord-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('telegram','Telegram','Public channel video','social','#F43F5E','globe',NULL,'["t.me", "telegram.me", "telegram.org"]','https://t.me/','telegram-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('whatsapp','WhatsApp','Channel & status video','social','#F97316','globe',NULL,'["whatsapp.com", "wa.me"]','https://whatsapp.com/','whatsapp-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('line','LINE','LINE video posts','social','#EAB308','globe',NULL,'["line.me"]','https://line.me/','line-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('kakaotalk','KakaoTalk','Kakao channel video','social','#22C55E','globe',NULL,'["kakao.com"]','https://kakao.com/','kakaotalk-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('lemon8','Lemon8','Lemon8 video posts','social','#14B8A6','globe',NULL,'["lemon8-app.com", "lemon8.com"]','https://lemon8-app.com/','lemon8-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('mewe','MeWe','MeWe videos','social','#06B6D4','globe',NULL,'["mewe.com"]','https://mewe.com/','mewe-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('diaspora','Diaspora','Federated video','social','#64748B','globe',NULL,'["diaspora.org", "diasporafoundation.org"]','https://diaspora.org/','diaspora-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('nextdoor','Nextdoor','Neighbourhood video posts','social','#2563EB','globe',NULL,'["nextdoor.com"]','https://nextdoor.com/','nextdoor-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('facebook_live','Facebook Live','Live stream capture','social','#0EA5E9','globe',NULL,'["facebook.com"]','https://facebook.com/','facebook-live-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('youtube_live','YouTube Live','Live stream capture','social','#6366F1','globe',NULL,'["youtube.com"]','https://youtube.com/','youtube-live-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('tiktok_live','TikTok LIVE','Live stream capture','social','#8B5CF6','globe',NULL,'["tiktok.com"]','https://tiktok.com/','tiktok-live-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('instagram_live','Instagram Live','Live stream capture','social','#EC4899','globe',NULL,'["instagram.com"]','https://instagram.com/','instagram-live-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('quora','Quora','Answer videos','social','#F43F5E','globe',NULL,'["quora.com"]','https://quora.com/','quora-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('hacker_news','Hacker News','Linked video pages','social','#F97316','globe',NULL,'["news.ycombinator.com"]','https://news.ycombinator.com/','hacker-news-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('indie_hackers','Indie Hackers','Founder videos','social','#EAB308','globe',NULL,'["indiehackers.com"]','https://indiehackers.com/','indie-hackers-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('product_hunt','Product Hunt','Product demo videos','social','#22C55E','globe',NULL,'["producthunt.com"]','https://producthunt.com/','product-hunt-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('xda_forums','XDA Forums','Forum videos','social','#14B8A6','globe',NULL,'["xda-developers.com"]','https://xda-developers.com/','xda-forums-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('macrumors_forums','MacRumors Forums','Forum videos','social','#06B6D4','globe',NULL,'["forums.macrumors.com"]','https://forums.macrumors.com/','macrumors-forums-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('lemmy','Lemmy','Federated video posts','social','#64748B','globe',NULL,'["lemmy.world", "lemmy.ml"]','https://lemmy.world/','lemmy-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('instructables','Instructables','Project videos','social','#2563EB','globe',NULL,'["instructables.com"]','https://instructables.com/','instructables-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('hackaday','Hackaday','Project videos','social','#0EA5E9','globe',NULL,'["hackaday.com"]','https://hackaday.com/','hackaday-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('netflix','Netflix','Trailers & free previews (DRM titles excluded)','video','#6366F1','globe',NULL,'["netflix.com"]','https://netflix.com/','netflix-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('amazon_prime_video','Amazon Prime Video','Trailers & free episodes','video','#8B5CF6','globe',NULL,'["primevideo.com", "amazon.com"]','https://primevideo.com/','amazon-prime-video-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('disney','Disney+','Official trailers & clips','video','#EC4899','globe',NULL,'["disneyplus.com"]','https://disneyplus.com/','disney-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('max','Max','Official trailers & clips','video','#F43F5E','globe',NULL,'["max.com", "hbomax.com"]','https://max.com/','max-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('apple_tv','Apple TV+','Trailers & free episodes','video','#F97316','globe',NULL,'["tv.apple.com"]','https://tv.apple.com/','apple-tv-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('paramount','Paramount+','Trailers & free episodes','video','#EAB308','globe',NULL,'["paramountplus.com"]','https://paramountplus.com/','paramount-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('hulu','Hulu','Trailers & free episodes','video','#22C55E','globe',NULL,'["hulu.com"]','https://hulu.com/','hulu-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('peacock','Peacock','Trailers & free episodes','video','#14B8A6','globe',NULL,'["peacocktv.com"]','https://peacocktv.com/','peacock-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('tubi','Tubi','Free ad-supported movies','video','#06B6D4','globe',NULL,'["tubitv.com"]','https://tubitv.com/','tubi-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('pluto_tv','Pluto TV','Free live channels & VOD','video','#64748B','globe',NULL,'["pluto.tv"]','https://pluto.tv/','pluto-tv-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('plex','Plex','Free movies & personal media','video','#2563EB','globe',NULL,'["plex.tv"]','https://plex.tv/','plex-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('the_roku_channel','The Roku Channel','Free movies & shows','video','#0EA5E9','globe',NULL,'["therokuchannel.roku.com", "roku.com"]','https://therokuchannel.roku.com/','the-roku-channel-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('mubi','MUBI','Trailers & film previews','video','#6366F1','globe',NULL,'["mubi.com"]','https://mubi.com/','mubi-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('crunchyroll','Crunchyroll','Anime trailers & free episodes','video','#8B5CF6','globe',NULL,'["crunchyroll.com"]','https://crunchyroll.com/','crunchyroll-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('jiohotstar','JioHotstar','Free episodes & trailers','video','#EC4899','globe',NULL,'["hotstar.com", "jiohotstar.com", "jiocinema.com"]','https://hotstar.com/','jiohotstar-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('zee5','ZEE5','Free episodes & trailers','video','#F43F5E','globe',NULL,'["zee5.com"]','https://zee5.com/','zee5-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('sony_liv','Sony LIV','Free episodes & trailers','video','#F97316','globe',NULL,'["sonyliv.com"]','https://sonyliv.com/','sony-liv-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('aha','Aha','Free episodes & trailers','video','#EAB308','globe',NULL,'["aha.video"]','https://aha.video/','aha-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('hoichoi','Hoichoi','Trailers & free episodes','video','#22C55E','globe',NULL,'["hoichoi.tv"]','https://hoichoi.tv/','hoichoi-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('shahid','Shahid','Free episodes & trailers','video','#14B8A6','globe',NULL,'["shahid.net"]','https://shahid.net/','shahid-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('starzplay','STARZPLAY','Trailers & free episodes','video','#06B6D4','globe',NULL,'["starzplay.com"]','https://starzplay.com/','starzplay-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('iqiyi','iQIYI','Free episodes & trailers','video','#64748B','globe',NULL,'["iq.com", "iqiyi.com"]','https://iq.com/','iqiyi-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('wetv','WeTV','Free episodes & trailers','video','#2563EB','globe',NULL,'["wetv.vip"]','https://wetv.vip/','wetv-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('viki','Viki','Free episodes & trailers','video','#0EA5E9','globe',NULL,'["viki.com"]','https://viki.com/','viki-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('youku','Youku','Free episodes & trailers','video','#6366F1','globe',NULL,'["youku.com"]','https://youku.com/','youku-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('dailymotion','Dailymotion','Full HD HLS & MP4','video','#8B5CF6','globe',NULL,'["dailymotion.com", "dai.ly"]','https://dailymotion.com/','dailymotion-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('vimeo','Vimeo','Public & unlisted videos','video','#EC4899','globe',NULL,'["vimeo.com"]','https://vimeo.com/','vimeo-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('twitch','Twitch','VODs, clips & live','video','#F43F5E','globe',NULL,'["twitch.tv"]','https://twitch.tv/','twitch-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('kick','Kick','Stream VODs & clips','video','#F97316','globe',NULL,'["kick.com"]','https://kick.com/','kick-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('rumble','Rumble','Full HD video','video','#EAB308','globe',NULL,'["rumble.com"]','https://rumble.com/','rumble-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('bilibili','Bilibili','Video & anime','video','#22C55E','globe',NULL,'["bilibili.com", "b23.tv"]','https://bilibili.com/','bilibili-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('kuaishou','Kuaishou','Short video','video','#14B8A6','globe',NULL,'["kuaishou.com"]','https://kuaishou.com/','kuaishou-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('likee','Likee','Short video','video','#06B6D4','globe',NULL,'["likee.video"]','https://likee.video/','likee-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('odysee','Odysee','Decentralised video','video','#64748B','globe',NULL,'["odysee.com"]','https://odysee.com/','odysee-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('peertube','PeerTube','Federated video','video','#2563EB','globe',NULL,'["peertube.tv"]','https://peertube.tv/','peertube-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('dtube','DTube','Blockchain video','video','#0EA5E9','globe',NULL,'["d.tube"]','https://d.tube/','dtube-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('bbc_iplayer','BBC iPlayer','Free trailers & clips','video','#6366F1','globe',NULL,'["bbc.co.uk", "bbc.com"]','https://bbc.co.uk/','bbc-iplayer-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('itvx','ITVX','Free episodes & trailers','video','#8B5CF6','globe',NULL,'["itv.com"]','https://itv.com/','itvx-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('channel_4','Channel 4','Free episodes & trailers','video','#EC4899','globe',NULL,'["channel4.com"]','https://channel4.com/','channel-4-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('abc_iview','ABC iview','Free episodes & clips','video','#F43F5E','globe',NULL,'["iview.abc.net.au", "abc.net.au"]','https://iview.abc.net.au/','abc-iview-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('sbs_on_demand','SBS On Demand','Free episodes & clips','video','#F97316','globe',NULL,'["sbs.com.au"]','https://sbs.com.au/','sbs-on-demand-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('tvnz','TVNZ+','Free episodes & clips','video','#EAB308','globe',NULL,'["tvnz.co.nz"]','https://tvnz.co.nz/','tvnz-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('sun_nxt','Sun NXT','Free episodes & trailers','video','#22C55E','globe',NULL,'["sunnxt.com"]','https://sunnxt.com/','sun-nxt-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('eros_now','Eros Now','Free episodes & trailers','video','#14B8A6','globe',NULL,'["erosnow.com"]','https://erosnow.com/','eros-now-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('watch_it','WATCH IT','Trailers & free episodes','video','#06B6D4','globe',NULL,'["watchit.com"]','https://watchit.com/','watch-it-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('adtv','ADtv','Trailers & free episodes','video','#64748B','globe',NULL,'["adtv.ae"]','https://adtv.ae/','adtv-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('kocowa','KOCOWA+','Trailers & free episodes','video','#2563EB','globe',NULL,'["kocowa.com"]','https://kocowa.com/','kocowa-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('kbs_world','KBS World','Free clips','video','#0EA5E9','globe',NULL,'["kbsworld.kbs.co.kr", "kbs.co.kr"]','https://kbsworld.kbs.co.kr/','kbs-world-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('ondemandkorea','OnDemandKorea','Free clips & trailers','video','#6366F1','globe',NULL,'["ondemandkorea.com"]','https://ondemandkorea.com/','ondemandkorea-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('anime_onegai','Anime Onegai','Trailers & free episodes','video','#8B5CF6','globe',NULL,'["animeonegai.com"]','https://animeonegai.com/','anime-onegai-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('adn','ADN','Trailers & free episodes','video','#EC4899','globe',NULL,'["animedigitalnetwork.fr"]','https://animedigitalnetwork.fr/','adn-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('reelshort','ReelShort','Short drama episodes','video','#F43F5E','globe',NULL,'["reelshort.com"]','https://reelshort.com/','reelshort-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('dramabox','DramaBox','Short drama episodes','video','#F97316','globe',NULL,'["dramabox.com", "dramaboxapp.com"]','https://dramabox.com/','dramabox-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('shortmax','ShortMax','Short drama episodes','video','#EAB308','globe',NULL,'["shortmax.com"]','https://shortmax.com/','shortmax-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('flextv','FlexTV','Short drama episodes','video','#22C55E','globe',NULL,'["flextv.com"]','https://flextv.com/','flextv-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('apple_tv_store','Apple TV Store','Purchased & trailer content','video','#14B8A6','globe',NULL,'["tv.apple.com"]','https://tv.apple.com/','apple-tv-store-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('prime_video_store','Prime Video Store','Purchased & trailer content','video','#06B6D4','globe',NULL,'["primevideo.com"]','https://primevideo.com/','prime-video-store-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('google_tv','Google TV','Purchased & trailer content','video','#64748B','globe',NULL,'["tv.google.com"]','https://tv.google.com/','google-tv-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('fandango_at_home','Fandango at Home','Trailers & free titles','video','#2563EB','globe',NULL,'["fandango.com", "vudu.com"]','https://fandango.com/','fandango-at-home-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('internet_archive','Internet Archive','Public-domain movies','video','#0EA5E9','globe',NULL,'["archive.org"]','https://archive.org/','internet-archive-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('national_film_board_of_canada','National Film Board of Canada','Free documentary films','video','#6366F1','globe',NULL,'["nfb.ca"]','https://nfb.ca/','national-film-board-of-canada-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('library_of_congress_collections','Library of Congress Collections','Public-domain film archives','video','#8B5CF6','globe',NULL,'["loc.gov"]','https://loc.gov/','library-of-congress-collections-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('jellyfin','Jellyfin','Self-hosted media','video','#EC4899','globe',NULL,'["jellyfin.org"]','https://jellyfin.org/','jellyfin-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('emby','Emby','Self-hosted media','video','#F43F5E','globe',NULL,'["emby.media"]','https://emby.media/','emby-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('kodi','Kodi','Home-theatre media','video','#F97316','globe',NULL,'["kodi.tv"]','https://kodi.tv/','kodi-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('wistia','Wistia','Business video embeds','video','#EAB308','globe',NULL,'["wistia.com", "wi.st"]','https://wistia.com/','wistia-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('brightcove','Brightcove','Enterprise video player','video','#22C55E','globe',NULL,'["brightcove.com", "players.brightcove.net"]','https://brightcove.com/','brightcove-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('kaltura','Kaltura','Enterprise video player','video','#14B8A6','globe',NULL,'["kaltura.com"]','https://kaltura.com/','kaltura-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('jw_player','JW Player','Player embeds','video','#06B6D4','globe',NULL,'["jwplayer.com", "cdn.jwplayer.com"]','https://jwplayer.com/','jw-player-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('ted','TED','Talks in HD','video','#64748B','globe',NULL,'["ted.com"]','https://ted.com/','ted-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('masterclass','MasterClass','Trailers & free lessons','video','#2563EB','globe',NULL,'["masterclass.com"]','https://masterclass.com/','masterclass-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('nebula','Nebula','Trailers & free videos','video','#0EA5E9','globe',NULL,'["nebula.tv"]','https://nebula.tv/','nebula-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('curiosity_stream','Curiosity Stream','Trailers & free videos','video','#6366F1','globe',NULL,'["curiositystream.com"]','https://curiositystream.com/','curiosity-stream-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('kanopy','Kanopy','Trailers & free titles','video','#8B5CF6','globe',NULL,'["kanopy.com"]','https://kanopy.com/','kanopy-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('docplay','DocPlay','Documentary trailers','video','#EC4899','globe',NULL,'["docplay.com"]','https://docplay.com/','docplay-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('dazn','DAZN','Free clips & highlights','video','#F43F5E','globe',NULL,'["dazn.com"]','https://dazn.com/','dazn-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('fubo','Fubo','Free clips & trailers','video','#F97316','globe',NULL,'["fubo.tv"]','https://fubo.tv/','fubo-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('espn_plus','ESPN+','Highlights & clips','video','#EAB308','globe',NULL,'["espnplus.com", "plus.espn.com"]','https://espnplus.com/','espn-plus-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('bein_sports','beIN SPORTS','Highlights & clips','video','#22C55E','globe',NULL,'["beinsports.com"]','https://beinsports.com/','bein-sports-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('nba_league_pass','NBA League Pass','Free highlights','video','#14B8A6','globe',NULL,'["nba.com"]','https://nba.com/','nba-league-pass-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('espn','ESPN','Highlights & clips','video','#06B6D4','globe',NULL,'["espn.com"]','https://espn.com/','espn-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('fifa','FIFA+','Free football archive','video','#64748B','globe',NULL,'["plus.fifa.com", "fifa.com"]','https://plus.fifa.com/','fifa-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('formula_1_tv','Formula 1 TV','Free highlights','video','#2563EB','globe',NULL,'["formula1.com"]','https://formula1.com/','formula-1-tv-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('ufc_fight_pass','UFC Fight Pass','Free fights & highlights','video','#0EA5E9','globe',NULL,'["ufc.com", "ufcfightpass.com"]','https://ufc.com/','ufc-fight-pass-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('fancode','FanCode','Free highlights','video','#6366F1','globe',NULL,'["fancode.com"]','https://fancode.com/','fancode-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('icc_digital_platforms','ICC Digital Platforms','Free cricket highlights','video','#8B5CF6','globe',NULL,'["icc-cricket.com"]','https://icc-cricket.com/','icc-digital-platforms-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('freevee_legacy_catalogue','Freevee Legacy Catalogue','Free ad-supported titles','video','#EC4899','globe',NULL,'["amazon.com", "primevideo.com"]','https://amazon.com/','freevee-legacy-catalogue-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('filmrise','FilmRise','Free movies & TV','video','#F43F5E','globe',NULL,'["filmrise.com"]','https://filmrise.com/','filmrise-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('fawesome','Fawesome','Free movies','video','#F97316','globe',NULL,'["fawesome.tv"]','https://fawesome.tv/','fawesome-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('xumo_play','Xumo Play','Free live & on-demand','video','#EAB308','globe',NULL,'["xumo.tv"]','https://xumo.tv/','xumo-play-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('rakuten_tv','Rakuten TV','Free ad-supported titles','video','#22C55E','globe',NULL,'["rakuten.tv"]','https://rakuten.tv/','rakuten-tv-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('criterion_channel','Criterion Channel','Trailers & free films','video','#14B8A6','globe',NULL,'["criterion.com"]','https://criterion.com/','criterion-channel-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('ovid_tv','OVID.tv','Documentary trailers','video','#06B6D4','globe',NULL,'["ovid.tv"]','https://ovid.tv/','ovid-tv-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('film_movement_plus','Film Movement Plus','Trailers & free shorts','video','#64748B','globe',NULL,'["filmmovement.com"]','https://filmmovement.com/','film-movement-plus-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('bfi_player','BFI Player','Free archive films','video','#2563EB','globe',NULL,'["bfi.org.uk"]','https://bfi.org.uk/','bfi-player-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('lacinetek','LaCinetek','Trailers','video','#0EA5E9','globe',NULL,'["lacinetek.com"]','https://lacinetek.com/','lacinetek-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('vimeo_ott','Vimeo OTT','OTT channel videos','video','#6366F1','globe',NULL,'["vimeo.com", "ott.vimeo.com"]','https://vimeo.com/','vimeo-ott-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('letterboxd','Letterboxd','Trailer pages','video','#8B5CF6','globe',NULL,'["letterboxd.com"]','https://letterboxd.com/','letterboxd-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('imdb','IMDb','Trailers & clips','video','#EC4899','globe',NULL,'["imdb.com"]','https://imdb.com/','imdb-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('tmdb','TMDb','Trailer pages','video','#F43F5E','globe',NULL,'["themoviedb.org"]','https://themoviedb.org/','tmdb-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('justwatch','JustWatch','Trailer pages','video','#F97316','globe',NULL,'["justwatch.com"]','https://justwatch.com/','justwatch-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('rotten_tomatoes','Rotten Tomatoes','Trailers & clips','video','#EAB308','globe',NULL,'["rottentomatoes.com"]','https://rottentomatoes.com/','rotten-tomatoes-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('trakt','Trakt','Trailer pages','video','#22C55E','globe',NULL,'["trakt.tv"]','https://trakt.tv/','trakt-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('myanimelist','MyAnimeList','Trailer pages','video','#14B8A6','globe',NULL,'["myanimelist.net"]','https://myanimelist.net/','myanimelist-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('anilist','AniList','Trailer pages','video','#06B6D4','globe',NULL,'["anilist.co"]','https://anilist.co/','anilist-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('goodreads','Goodreads','Author video pages','video','#64748B','globe',NULL,'["goodreads.com"]','https://goodreads.com/','goodreads-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('the_storygraph','The StoryGraph','Book video pages','video','#2563EB','globe',NULL,'["thestorygraph.com"]','https://thestorygraph.com/','the-storygraph-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('youtube_music','YouTube Music','Songs, albums, live sets','video','#0EA5E9','globe',NULL,'["music.youtube.com"]','https://music.youtube.com/','youtube-music-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('spotify','Spotify','Podcast & video episodes','video','#6366F1','globe',NULL,'["spotify.com", "open.spotify.com"]','https://spotify.com/','spotify-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('apple_music','Apple Music','Music videos & previews','video','#8B5CF6','globe',NULL,'["music.apple.com"]','https://music.apple.com/','apple-music-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('amazon_music','Amazon Music','Music videos','video','#EC4899','globe',NULL,'["music.amazon.com", "music.amazon.in"]','https://music.amazon.com/','amazon-music-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('soundcloud','SoundCloud','Original MP3/Opus audio','video','#F43F5E','globe',NULL,'["soundcloud.com"]','https://soundcloud.com/','soundcloud-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('deezer','Deezer','Music videos & previews','video','#F97316','globe',NULL,'["deezer.com"]','https://deezer.com/','deezer-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('tidal','Tidal','Music videos','video','#EAB308','globe',NULL,'["tidal.com"]','https://tidal.com/','tidal-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('pandora','Pandora','Song previews','video','#22C55E','globe',NULL,'["pandora.com"]','https://pandora.com/','pandora-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('audiomack','Audiomack','Free MP3 downloads','video','#14B8A6','globe',NULL,'["audiomack.com"]','https://audiomack.com/','audiomack-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('bandcamp','Bandcamp','Artist audio & video','video','#06B6D4','globe',NULL,'["bandcamp.com"]','https://bandcamp.com/','bandcamp-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('mixcloud','Mixcloud','DJ mixes & radio','video','#64748B','globe',NULL,'["mixcloud.com"]','https://mixcloud.com/','mixcloud-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('apple_podcasts','Apple Podcasts','Podcast episodes','video','#2563EB','globe',NULL,'["podcasts.apple.com"]','https://podcasts.apple.com/','apple-podcasts-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('pocket_casts','Pocket Casts','Podcast episodes','video','#0EA5E9','globe',NULL,'["pocketcasts.com"]','https://pocketcasts.com/','pocket-casts-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('castbox','Castbox','Podcast episodes','video','#6366F1','globe',NULL,'["castbox.fm"]','https://castbox.fm/','castbox-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('tunein','TuneIn','Radio & podcasts','video','#8B5CF6','globe',NULL,'["tunein.com"]','https://tunein.com/','tunein-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('udemy','Udemy','Course lectures (with your cookies)','education','#EC4899','globe',NULL,'["udemy.com"]','https://udemy.com/','udemy-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('coursera','Coursera','Lectures & trailers','education','#F43F5E','globe',NULL,'["coursera.org"]','https://coursera.org/','coursera-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('edx','edX','Course lectures','education','#F97316','globe',NULL,'["edx.org"]','https://edx.org/','edx-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('linkedin_learning','LinkedIn Learning','Course lectures','education','#EAB308','globe',NULL,'["linkedin.com/learning"]','https://linkedin.com/','linkedin-learning-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('skillshare','Skillshare','Class lessons','education','#22C55E','globe',NULL,'["skillshare.com"]','https://skillshare.com/','skillshare-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('pluralsight','Pluralsight','Course modules','education','#14B8A6','globe',NULL,'["pluralsight.com"]','https://pluralsight.com/','pluralsight-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('codecademy','Codecademy','Lesson videos','education','#06B6D4','globe',NULL,'["codecademy.com"]','https://codecademy.com/','codecademy-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('freecodecamp','freeCodeCamp','Full courses & tutorials','education','#64748B','globe',NULL,'["freecodecamp.org"]','https://freecodecamp.org/','freecodecamp-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('khan_academy','Khan Academy','Lesson videos','education','#2563EB','globe',NULL,'["khanacademy.org"]','https://khanacademy.org/','khan-academy-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('udacity','Udacity','Lesson videos','education','#0EA5E9','globe',NULL,'["udacity.com"]','https://udacity.com/','udacity-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('datacamp','DataCamp','Lesson videos','education','#6366F1','globe',NULL,'["datacamp.com"]','https://datacamp.com/','datacamp-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('brilliant','Brilliant','Lesson animations','education','#8B5CF6','globe',NULL,'["brilliant.org"]','https://brilliant.org/','brilliant-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('frontend_masters','Frontend Masters','Course videos','education','#EC4899','globe',NULL,'["frontendmasters.com"]','https://frontendmasters.com/','frontend-masters-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('scrimba','Scrimba','Interactive lessons','education','#F43F5E','globe',NULL,'["scrimba.com"]','https://scrimba.com/','scrimba-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('educative','Educative','Course videos','education','#F97316','globe',NULL,'["educative.io"]','https://educative.io/','educative-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('futurelearn','FutureLearn','Course videos','education','#EAB308','globe',NULL,'["futurelearn.com"]','https://futurelearn.com/','futurelearn-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('openlearn','OpenLearn','Free course videos','education','#22C55E','globe',NULL,'["open.edu"]','https://open.edu/','openlearn-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('mit_opencourseware','MIT OpenCourseWare','Full lecture archive','education','#14B8A6','globe',NULL,'["ocw.mit.edu"]','https://ocw.mit.edu/','mit-opencourseware-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('harvard_online','Harvard Online','Lecture videos','education','#06B6D4','globe',NULL,'["harvard.edu", "cs50.harvard.edu"]','https://harvard.edu/','harvard-online-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('cisco_networking_academy','Cisco Networking Academy','Lesson videos','education','#64748B','globe',NULL,'["netacad.com"]','https://netacad.com/','cisco-networking-academy-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('tryhackme','TryHackMe','Lab walkthroughs','education','#2563EB','globe',NULL,'["tryhackme.com"]','https://tryhackme.com/','tryhackme-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('hack_the_box_academy','Hack The Box Academy','Module videos','education','#0EA5E9','globe',NULL,'["academy.hackthebox.com", "hackthebox.com"]','https://academy.hackthebox.com/','hack-the-box-academy-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('deeplearning_ai','DeepLearning.AI','Course videos','education','#6366F1','globe',NULL,'["deeplearning.ai"]','https://deeplearning.ai/','deeplearning-ai-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('microsoft_learn','Microsoft Learn','Learning videos','education','#8B5CF6','globe',NULL,'["learn.microsoft.com"]','https://learn.microsoft.com/','microsoft-learn-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('aws_skill_builder','AWS Skill Builder','Cloud training','education','#EC4899','globe',NULL,'["skillbuilder.aws", "aws.amazon.com"]','https://skillbuilder.aws/','aws-skill-builder-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('unity_learn','Unity Learn','Game-dev lessons','education','#F43F5E','globe',NULL,'["learn.unity.com"]','https://learn.unity.com/','unity-learn-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('unreal_engine','Unreal Engine','Engine tutorials','education','#F97316','globe',NULL,'["unrealengine.com"]','https://unrealengine.com/','unreal-engine-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('open_edx','Open edX','Course videos','education','#EAB308','globe',NULL,'["openedx.org"]','https://openedx.org/','open-edx-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('moodle_academy','Moodle Academy','Course videos','education','#22C55E','globe',NULL,'["moodle.org", "moodle.academy"]','https://moodle.org/','moodle-academy-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('canvas_network','Canvas Network','Course videos','education','#14B8A6','globe',NULL,'["canvas.net", "instructure.com"]','https://canvas.net/','canvas-network-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('alison','Alison','Free course videos','education','#06B6D4','globe',NULL,'["alison.com"]','https://alison.com/','alison-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('simplilearn','Simplilearn','Course videos','education','#64748B','globe',NULL,'["simplilearn.com"]','https://simplilearn.com/','simplilearn-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('great_learning_academy','Great Learning Academy','Free course videos','education','#2563EB','globe',NULL,'["mygreatlearning.com"]','https://mygreatlearning.com/','great-learning-academy-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('ibm_skillsbuild','IBM SkillsBuild','Course videos','education','#0EA5E9','globe',NULL,'["skillsbuild.org"]','https://skillsbuild.org/','ibm-skillsbuild-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('google_skillshop','Google Skillshop','Google course videos','education','#6366F1','globe',NULL,'["skillshop.withgoogle.com"]','https://skillshop.withgoogle.com/','google-skillshop-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('oracle_university','Oracle University','Course videos','education','#8B5CF6','globe',NULL,'["education.oracle.com"]','https://education.oracle.com/','oracle-university-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('red_hat_learning','Red Hat Learning','Course videos','education','#EC4899','globe',NULL,'["redhat.com"]','https://redhat.com/','red-hat-learning-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('linux_foundation_training','Linux Foundation Training','Course videos','education','#F43F5E','globe',NULL,'["training.linuxfoundation.org"]','https://training.linuxfoundation.org/','linux-foundation-training-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('nvidia_deep_learning_institute','NVIDIA Deep Learning Institute','Course videos','education','#F97316','globe',NULL,'["nvidia.com"]','https://nvidia.com/','nvidia-deep-learning-institute-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('fast_ai','fast.ai','Full lecture videos','education','#EAB308','globe',NULL,'["fast.ai"]','https://fast.ai/','fast-ai-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('kaggle_learn','Kaggle Learn','Lesson videos','education','#22C55E','globe',NULL,'["kaggle.com"]','https://kaggle.com/','kaggle-learn-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('hugging_face_learn','Hugging Face Learn','Course videos','education','#14B8A6','globe',NULL,'["huggingface.co"]','https://huggingface.co/','hugging-face-learn-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('portswigger_web_security_academy','PortSwigger Web Security Academy','Lab videos','education','#06B6D4','globe',NULL,'["portswigger.net"]','https://portswigger.net/','portswigger-web-security-academy-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('pentesterlab','PentesterLab','Exercise videos','education','#64748B','globe',NULL,'["pentesterlab.com"]','https://pentesterlab.com/','pentesterlab-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('cyberdefenders','CyberDefenders','Blue-team labs','education','#2563EB','globe',NULL,'["cyberdefenders.org"]','https://cyberdefenders.org/','cyberdefenders-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('blue_team_labs_online','Blue Team Labs Online','Lab videos','education','#0EA5E9','globe',NULL,'["blueteamlabs.online"]','https://blueteamlabs.online/','blue-team-labs-online-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('letsdefend','LetsDefend','SOC training','education','#6366F1','globe',NULL,'["letsdefend.io"]','https://letsdefend.io/','letsdefend-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('cybrary','Cybrary','Course videos','education','#8B5CF6','globe',NULL,'["cybrary.it"]','https://cybrary.it/','cybrary-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('professor_messer','Professor Messer','Free IT training','education','#EC4899','globe',NULL,'["professormesser.com"]','https://professormesser.com/','professor-messer-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('kodekloud','KodeKloud','DevOps labs','education','#F43F5E','globe',NULL,'["kodekloud.com"]','https://kodekloud.com/','kodekloud-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('cbt_nuggets','CBT Nuggets','IT training videos','education','#F97316','globe',NULL,'["cbtnuggets.com"]','https://cbtnuggets.com/','cbt-nuggets-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('saylor_academy','Saylor Academy','Free course videos','education','#EAB308','globe',NULL,'["saylor.org"]','https://saylor.org/','saylor-academy-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('academic_earth','Academic Earth','Free lectures','education','#22C55E','globe',NULL,'["academicearth.org"]','https://academicearth.org/','academic-earth-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('open_yale_courses','Open Yale Courses','Free lectures','education','#14B8A6','globe',NULL,'["oyc.yale.edu", "yale.edu"]','https://oyc.yale.edu/','open-yale-courses-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('researchgate','ResearchGate','Paper video pages','education','#06B6D4','globe',NULL,'["researchgate.net"]','https://researchgate.net/','researchgate-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('wikipedia','Wikipedia','Article media','education','#64748B','globe',NULL,'["wikipedia.org"]','https://wikipedia.org/','wikipedia-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('google_scholar','Google Scholar','Paper pages','education','#2563EB','globe',NULL,'["scholar.google.com"]','https://scholar.google.com/','google-scholar-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('jstor','JSTOR','Archived lectures','education','#0EA5E9','globe',NULL,'["jstor.org"]','https://jstor.org/','jstor-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('arxiv','arXiv','Paper & talk pages','education','#6366F1','globe',NULL,'["arxiv.org"]','https://arxiv.org/','arxiv-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('semantic_scholar','Semantic Scholar','Paper talk pages','education','#8B5CF6','globe',NULL,'["semanticscholar.org"]','https://semanticscholar.org/','semantic-scholar-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('openstax','OpenStax','Free textbook media','education','#EC4899','globe',NULL,'["openstax.org"]','https://openstax.org/','openstax-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('terabox','TeraBox','Free cloud video & file download','cloud_terabox','#F43F5E','globe',NULL,'["terabox.com", "terabox.app"]','https://terabox.com/','terabox-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('iteraplay','iTeraPlay','TeraBox free stream engine','cloud_terabox','#F97316','globe',NULL,'["iteraplay.com", "iteraplayvideo.com"]','https://iteraplay.com/','iteraplay-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('teraviralhub','TeraViralHub','TeraBox viral mirror','cloud_terabox','#EAB308','globe',NULL,'["teraviralhub.com"]','https://teraviralhub.com/','teraviralhub-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('mirrobox','MirroBox','TeraBox mirror','cloud_terabox','#22C55E','globe',NULL,'["mirrobox.com"]','https://mirrobox.com/','mirrobox-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('nephobox','NephoBox','TeraBox mirror','cloud_terabox','#14B8A6','globe',NULL,'["nephobox.com"]','https://nephobox.com/','nephobox-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('freeterabox','FreeTeraBox','TeraBox mirror','cloud_terabox','#06B6D4','globe',NULL,'["freeterabox.com"]','https://freeterabox.com/','freeterabox-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('1024tera','1024Tera','TeraBox mirror','cloud_terabox','#64748B','globe',NULL,'["1024tera.com", "1024tera.co"]','https://1024tera.com/','1024tera-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('4funbox','4FunBox','TeraBox mirror','cloud_terabox','#2563EB','globe',NULL,'["4funbox.com", "4funbox.co"]','https://4funbox.com/','4funbox-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('terabox_link','TeraBox Link','Share-link resolver','cloud_terabox','#0EA5E9','globe',NULL,'["teraboxlink.com", "teraboxurl.com"]','https://teraboxlink.com/','terabox-link-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('google_drive','Google Drive','Public file & video download','cloud_terabox','#6366F1','globe',NULL,'["drive.google.com"]','https://drive.google.com/','google-drive-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('dropbox','Dropbox','Shared file & video download','cloud_terabox','#8B5CF6','globe',NULL,'["dropbox.com"]','https://dropbox.com/','dropbox-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('microsoft_onedrive','Microsoft OneDrive','Shared file download','cloud_terabox','#EC4899','globe',NULL,'["onedrive.live.com", "1drv.ms"]','https://onedrive.live.com/','microsoft-onedrive-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('icloud_drive','iCloud Drive','Shared file download','cloud_terabox','#F43F5E','globe',NULL,'["icloud.com"]','https://icloud.com/','icloud-drive-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('mega','MEGA','Public file download','cloud_terabox','#F97316','globe',NULL,'["mega.nz", "mega.io"]','https://mega.nz/','mega-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('box','Box','Shared file download','cloud_terabox','#EAB308','globe',NULL,'["box.com", "app.box.com"]','https://box.com/','box-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('pcloud','pCloud','Public file download','cloud_terabox','#22C55E','globe',NULL,'["pcloud.com", "e.pcloud.link"]','https://pcloud.com/','pcloud-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('proton_drive','Proton Drive','Shared file download','cloud_terabox','#14B8A6','globe',NULL,'["proton.me", "drive.proton.me"]','https://proton.me/','proton-drive-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('wetransfer','WeTransfer','Transfer link download','cloud_terabox','#06B6D4','globe',NULL,'["wetransfer.com", "we.tl"]','https://wetransfer.com/','wetransfer-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('send_anywhere','Send Anywhere','File transfer download','cloud_terabox','#64748B','globe',NULL,'["send-anywhere.com"]','https://send-anywhere.com/','send-anywhere-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('github','GitHub','Raw files, releases & video','cloud_terabox','#2563EB','globe',NULL,'["github.com", "raw.githubusercontent.com"]','https://github.com/','github-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('gitlab','GitLab','Raw files & releases','cloud_terabox','#0EA5E9','globe',NULL,'["gitlab.com"]','https://gitlab.com/','gitlab-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('bitbucket','Bitbucket','Repository files','cloud_terabox','#6366F1','globe',NULL,'["bitbucket.org"]','https://bitbucket.org/','bitbucket-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('chatgpt','ChatGPT','Shared conversations & generated media','web','#8B5CF6','globe',NULL,'["chatgpt.com", "chat.openai.com"]','https://chatgpt.com/','chatgpt-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('google_gemini','Google Gemini','Shared answers & media','web','#EC4899','globe',NULL,'["gemini.google.com"]','https://gemini.google.com/','google-gemini-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('claude','Claude','Shared conversations & media','web','#F43F5E','globe',NULL,'["claude.ai"]','https://claude.ai/','claude-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('microsoft_copilot','Microsoft Copilot','Shared media','web','#F97316','globe',NULL,'["copilot.microsoft.com"]','https://copilot.microsoft.com/','microsoft-copilot-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('perplexity','Perplexity','Shared answers','web','#EAB308','globe',NULL,'["perplexity.ai"]','https://perplexity.ai/','perplexity-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('deepseek','DeepSeek','Shared answers','web','#22C55E','globe',NULL,'["deepseek.com", "chat.deepseek.com"]','https://deepseek.com/','deepseek-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('grok','Grok','Shared media','web','#14B8A6','globe',NULL,'["grok.com"]','https://grok.com/','grok-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('meta_ai','Meta AI','Generated media','web','#06B6D4','globe',NULL,'["meta.ai"]','https://meta.ai/','meta-ai-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('hugging_face','Hugging Face','Model demos & media','web','#64748B','globe',NULL,'["huggingface.co"]','https://huggingface.co/','hugging-face-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('poe','Poe','Shared bot media','web','#2563EB','globe',NULL,'["poe.com"]','https://poe.com/','poe-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('midjourney','Midjourney','Generated images','web','#0EA5E9','globe',NULL,'["midjourney.com"]','https://midjourney.com/','midjourney-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('leonardo_ai','Leonardo AI','Generated images','web','#6366F1','globe',NULL,'["leonardo.ai"]','https://leonardo.ai/','leonardo-ai-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('adobe_firefly','Adobe Firefly','Generated images','web','#8B5CF6','globe',NULL,'["firefly.adobe.com"]','https://firefly.adobe.com/','adobe-firefly-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('ideogram','Ideogram','Generated images','web','#EC4899','globe',NULL,'["ideogram.ai"]','https://ideogram.ai/','ideogram-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('runway','Runway','Generated video','web','#F43F5E','globe',NULL,'["runwayml.com"]','https://runwayml.com/','runway-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('sora','Sora','Generated video','web','#F97316','globe',NULL,'["sora.com"]','https://sora.com/','sora-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('kling_ai','Kling AI','Generated video','web','#EAB308','globe',NULL,'["klingai.com"]','https://klingai.com/','kling-ai-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('pika','Pika','Generated video','web','#22C55E','globe',NULL,'["pika.art"]','https://pika.art/','pika-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('luma_dream_machine','Luma Dream Machine','Generated video','web','#14B8A6','globe',NULL,'["lumalabs.ai"]','https://lumalabs.ai/','luma-dream-machine-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('elevenlabs','ElevenLabs','Generated audio','web','#06B6D4','globe',NULL,'["elevenlabs.io"]','https://elevenlabs.io/','elevenlabs-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('google','Google','Video search results & pages','web','#64748B','globe',NULL,'["google.com"]','https://google.com/','google-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('bing','Bing','Video search results & pages','web','#2563EB','globe',NULL,'["bing.com"]','https://bing.com/','bing-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('yahoo','Yahoo','Video search results','web','#0EA5E9','globe',NULL,'["yahoo.com"]','https://yahoo.com/','yahoo-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('duckduckgo','DuckDuckGo','Video search results','web','#6366F1','globe',NULL,'["duckduckgo.com"]','https://duckduckgo.com/','duckduckgo-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('brave_search','Brave Search','Video search results','web','#8B5CF6','globe',NULL,'["search.brave.com"]','https://search.brave.com/','brave-search-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('baidu','Baidu','Video search results','web','#EC4899','globe',NULL,'["baidu.com"]','https://baidu.com/','baidu-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('yandex','Yandex','Video search results','web','#F43F5E','globe',NULL,'["yandex.com"]','https://yandex.com/','yandex-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('naver','Naver','Video search results','web','#F97316','globe',NULL,'["naver.com"]','https://naver.com/','naver-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('ecosia','Ecosia','Video search results','web','#EAB308','globe',NULL,'["ecosia.org"]','https://ecosia.org/','ecosia-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('startpage','Startpage','Video search results','web','#22C55E','globe',NULL,'["startpage.com"]','https://startpage.com/','startpage-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('chrome','Chrome','Extension & web store media','web','#14B8A6','globe',NULL,'["chrome.google.com"]','https://chrome.google.com/','chrome-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('firefox','Firefox','Add-on media pages','web','#06B6D4','globe',NULL,'["mozilla.org"]','https://mozilla.org/','firefox-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('microsoft_edge','Microsoft Edge','Add-on media pages','web','#64748B','globe',NULL,'["microsoftedge.microsoft.com"]','https://microsoftedge.microsoft.com/','microsoft-edge-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('safari','Safari','Apple web pages','web','#2563EB','globe',NULL,'["apple.com"]','https://apple.com/','safari-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('opera','Opera','Opera web pages','web','#0EA5E9','globe',NULL,'["opera.com"]','https://opera.com/','opera-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('steam','Steam','Game trailers','web','#6366F1','globe',NULL,'["store.steampowered.com", "steamcommunity.com"]','https://store.steampowered.com/','steam-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('epic_games_store','Epic Games Store','Game trailers','web','#8B5CF6','globe',NULL,'["store.epicgames.com", "epicgames.com"]','https://store.epicgames.com/','epic-games-store-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('gog','GOG','Game trailers','web','#EC4899','globe',NULL,'["gog.com"]','https://gog.com/','gog-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('playstation_network','PlayStation Network','Game trailers','web','#F43F5E','globe',NULL,'["playstation.com"]','https://playstation.com/','playstation-network-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('xbox_network','Xbox Network','Game trailers','web','#F97316','globe',NULL,'["xbox.com"]','https://xbox.com/','xbox-network-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('nintendo_eshop','Nintendo eShop','Game trailers','web','#EAB308','globe',NULL,'["nintendo.com"]','https://nintendo.com/','nintendo-eshop-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('roblox','Roblox','Game videos','web','#22C55E','globe',NULL,'["roblox.com"]','https://roblox.com/','roblox-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('minecraft','Minecraft','Game media','web','#14B8A6','globe',NULL,'["minecraft.net"]','https://minecraft.net/','minecraft-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('itch_io','itch.io','Game trailers','web','#06B6D4','globe',NULL,'["itch.io"]','https://itch.io/','itch-io-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('game_jolt','Game Jolt','Game trailers','web','#64748B','globe',NULL,'["gamejolt.com"]','https://gamejolt.com/','game-jolt-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('nvidia_geforce_now','NVIDIA GeForce NOW','Cloud gaming media','web','#2563EB','globe',NULL,'["nvidia.com"]','https://nvidia.com/','nvidia-geforce-now-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('xbox_cloud_gaming','Xbox Cloud Gaming','Cloud gaming media','web','#0EA5E9','globe',NULL,'["xbox.com"]','https://xbox.com/','xbox-cloud-gaming-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('boosteroid','Boosteroid','Cloud gaming media','web','#6366F1','globe',NULL,'["boosteroid.com"]','https://boosteroid.com/','boosteroid-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('amazon','Amazon','Product videos & Prime media','web','#8B5CF6','globe',NULL,'["amazon.com", "amzn.to"]','https://amazon.com/','amazon-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('ebay','eBay','Listing videos','web','#EC4899','globe',NULL,'["ebay.com"]','https://ebay.com/','ebay-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('aliexpress','AliExpress','Product videos','web','#F43F5E','globe',NULL,'["aliexpress.com"]','https://aliexpress.com/','aliexpress-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('temu','Temu','Product videos','web','#F97316','globe',NULL,'["temu.com"]','https://temu.com/','temu-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('etsy','Etsy','Listing videos','web','#EAB308','globe',NULL,'["etsy.com"]','https://etsy.com/','etsy-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('walmart','Walmart','Product videos','web','#22C55E','globe',NULL,'["walmart.com"]','https://walmart.com/','walmart-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('shopee','Shopee','Product videos','web','#14B8A6','globe',NULL,'["shopee.com"]','https://shopee.com/','shopee-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('lazada','Lazada','Product videos','web','#06B6D4','globe',NULL,'["lazada.com"]','https://lazada.com/','lazada-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('daraz','Daraz','Product videos','web','#64748B','globe',NULL,'["daraz.pk"]','https://daraz.pk/','daraz-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('olx','OLX','Classified videos','web','#2563EB','globe',NULL,'["olx.com", "olx.com.pk"]','https://olx.com/','olx-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('shopify','Shopify','Store & product video','web','#0EA5E9','globe',NULL,'["shopify.com"]','https://shopify.com/','shopify-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('woocommerce','WooCommerce','Store & product video','web','#6366F1','globe',NULL,'["woocommerce.com"]','https://woocommerce.com/','woocommerce-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('bigcommerce','BigCommerce','Store video','web','#8B5CF6','globe',NULL,'["bigcommerce.com"]','https://bigcommerce.com/','bigcommerce-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('gumroad','Gumroad','Product video & downloads','web','#EC4899','globe',NULL,'["gumroad.com"]','https://gumroad.com/','gumroad-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('patreon','Patreon','Public creator posts','web','#F43F5E','globe',NULL,'["patreon.com"]','https://patreon.com/','patreon-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('stack_overflow','Stack Overflow','Embedded media','web','#F97316','globe',NULL,'["stackoverflow.com"]','https://stackoverflow.com/','stack-overflow-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('stack_exchange','Stack Exchange','Embedded media','web','#EAB308','globe',NULL,'["stackexchange.com"]','https://stackexchange.com/','stack-exchange-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('replit','Replit','Project video','web','#22C55E','globe',NULL,'["replit.com"]','https://replit.com/','replit-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('codepen','CodePen','Demo video','web','#14B8A6','globe',NULL,'["codepen.io"]','https://codepen.io/','codepen-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('codesandbox','CodeSandbox','Demo video','web','#06B6D4','globe',NULL,'["codesandbox.io"]','https://codesandbox.io/','codesandbox-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('stackblitz','StackBlitz','Demo video','web','#64748B','globe',NULL,'["stackblitz.com"]','https://stackblitz.com/','stackblitz-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('npm','npm','Package media','web','#2563EB','globe',NULL,'["npmjs.com"]','https://npmjs.com/','npm-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('pypi','PyPI','Package media','web','#0EA5E9','globe',NULL,'["pypi.org"]','https://pypi.org/','pypi-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('docker_hub','Docker Hub','Image docs media','web','#6366F1','globe',NULL,'["hub.docker.com"]','https://hub.docker.com/','docker-hub-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('supabase','Supabase','Project media','web','#8B5CF6','globe',NULL,'["supabase.com"]','https://supabase.com/','supabase-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('firebase','Firebase','Project media','web','#EC4899','globe',NULL,'["firebase.google.com"]','https://firebase.google.com/','firebase-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('vercel','Vercel','Deployment media','web','#F43F5E','globe',NULL,'["vercel.com"]','https://vercel.com/','vercel-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('canva','Canva','Design & video exports','web','#F97316','globe',NULL,'["canva.com"]','https://canva.com/','canva-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('figma','Figma','Design & prototype video','web','#EAB308','globe',NULL,'["figma.com"]','https://figma.com/','figma-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('adobe_creative_cloud','Adobe Creative Cloud','Creative assets','web','#22C55E','globe',NULL,'["adobe.com"]','https://adobe.com/','adobe-creative-cloud-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('photopea','Photopea','Image project media','web','#14B8A6','globe',NULL,'["photopea.com"]','https://photopea.com/','photopea-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('behance','Behance','Portfolio videos','web','#06B6D4','globe',NULL,'["behance.net"]','https://behance.net/','behance-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('dribbble','Dribbble','Portfolio videos','web','#64748B','globe',NULL,'["dribbble.com"]','https://dribbble.com/','dribbble-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('artstation','ArtStation','Portfolio videos','web','#2563EB','globe',NULL,'["artstation.com"]','https://artstation.com/','artstation-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('deviantart','DeviantArt','Art & video posts','web','#0EA5E9','globe',NULL,'["deviantart.com"]','https://deviantart.com/','deviantart-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('500px','500px','Photo & video posts','web','#6366F1','globe',NULL,'["500px.com"]','https://500px.com/','500px-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('bbc_news','BBC News','News video','web','#8B5CF6','globe',NULL,'["bbc.com", "bbc.co.uk"]','https://bbc.com/','bbc-news-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('cnn','CNN','News video','web','#EC4899','globe',NULL,'["cnn.com"]','https://cnn.com/','cnn-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('reuters','Reuters','News video','web','#F43F5E','globe',NULL,'["reuters.com"]','https://reuters.com/','reuters-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('al_jazeera','Al Jazeera','News video','web','#F97316','globe',NULL,'["aljazeera.com"]','https://aljazeera.com/','al-jazeera-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('the_guardian','The Guardian','News video','web','#EAB308','globe',NULL,'["theguardian.com"]','https://theguardian.com/','the-guardian-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('the_new_york_times','The New York Times','News video','web','#22C55E','globe',NULL,'["nytimes.com"]','https://nytimes.com/','the-new-york-times-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('techcrunch','TechCrunch','News video','web','#14B8A6','globe',NULL,'["techcrunch.com"]','https://techcrunch.com/','techcrunch-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('the_verge','The Verge','News video','web','#06B6D4','globe',NULL,'["theverge.com"]','https://theverge.com/','the-verge-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('medium','Medium','Embedded video','web','#64748B','globe',NULL,'["medium.com"]','https://medium.com/','medium-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('substack','Substack','Newsletter video','web','#2563EB','globe',NULL,'["substack.com"]','https://substack.com/','substack-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('wordpress','WordPress','Blog video','web','#0EA5E9','globe',NULL,'["wordpress.com", "wordpress.org"]','https://wordpress.com/','wordpress-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('blogger','Blogger','Blog video','web','#6366F1','globe',NULL,'["blogger.com", "blogspot.com"]','https://blogger.com/','blogger-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('ghost','Ghost','Blog video','web','#8B5CF6','globe',NULL,'["ghost.org"]','https://ghost.org/','ghost-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('flipboard','Flipboard','Curated video','web','#EC4899','globe',NULL,'["flipboard.com"]','https://flipboard.com/','flipboard-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('feedly','Feedly','Feed video','web','#F43F5E','globe',NULL,'["feedly.com"]','https://feedly.com/','feedly-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('upwork','Upwork','Portfolio & job videos','web','#F97316','globe',NULL,'["upwork.com"]','https://upwork.com/','upwork-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('fiverr','Fiverr','Gig videos','web','#EAB308','globe',NULL,'["fiverr.com"]','https://fiverr.com/','fiverr-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('freelancer_com','Freelancer.com','Portfolio videos','web','#22C55E','globe',NULL,'["freelancer.com"]','https://freelancer.com/','freelancer-com-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('peopleperhour','PeoplePerHour','Portfolio videos','web','#14B8A6','globe',NULL,'["peopleperhour.com"]','https://peopleperhour.com/','peopleperhour-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('toptal','Toptal','Portfolio videos','web','#06B6D4','globe',NULL,'["toptal.com"]','https://toptal.com/','toptal-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('contra','Contra','Portfolio videos','web','#64748B','globe',NULL,'["contra.com"]','https://contra.com/','contra-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('guru','Guru','Portfolio videos','web','#2563EB','globe',NULL,'["guru.com"]','https://guru.com/','guru-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('99designs','99designs','Portfolio videos','web','#0EA5E9','globe',NULL,'["99designs.com"]','https://99designs.com/','99designs-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('indeed','Indeed','Job & company videos','web','#6366F1','globe',NULL,'["indeed.com"]','https://indeed.com/','indeed-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('notion','Notion','Embedded media','web','#8B5CF6','globe',NULL,'["notion.so", "notion.site"]','https://notion.so/','notion-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('trello','Trello','Attachment video','web','#EC4899','globe',NULL,'["trello.com"]','https://trello.com/','trello-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('asana','Asana','Attachment video','web','#F43F5E','globe',NULL,'["asana.com"]','https://asana.com/','asana-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('clickup','ClickUp','Attachment video','web','#F97316','globe',NULL,'["clickup.com"]','https://clickup.com/','clickup-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('monday_com','Monday.com','Attachment video','web','#EAB308','globe',NULL,'["monday.com"]','https://monday.com/','monday-com-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('jira','Jira','Attachment video','web','#22C55E','globe',NULL,'["atlassian.com", "jira.atlassian.com"]','https://atlassian.com/','jira-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('linear','Linear','Attachment video','web','#14B8A6','globe',NULL,'["linear.app"]','https://linear.app/','linear-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('airtable','Airtable','Attachment video','web','#06B6D4','globe',NULL,'["airtable.com"]','https://airtable.com/','airtable-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('todoist','Todoist','Attachment video','web','#64748B','globe',NULL,'["todoist.com"]','https://todoist.com/','todoist-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('obsidian','Obsidian','Vault media','web','#2563EB','globe',NULL,'["obsidian.md"]','https://obsidian.md/','obsidian-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('google_maps','Google Maps','Street-view & place video','web','#0EA5E9','globe',NULL,'["maps.google.com", "google.com/maps"]','https://maps.google.com/','google-maps-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('apple_maps','Apple Maps','Place media','web','#6366F1','globe',NULL,'["maps.apple.com"]','https://maps.apple.com/','apple-maps-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('waze','Waze','Dashcam & map video','web','#8B5CF6','globe',NULL,'["waze.com"]','https://waze.com/','waze-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('openstreetmap','OpenStreetMap','Map media','web','#EC4899','globe',NULL,'["openstreetmap.org"]','https://openstreetmap.org/','openstreetmap-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('booking_com','Booking.com','Hotel videos','web','#F43F5E','globe',NULL,'["booking.com"]','https://booking.com/','booking-com-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('airbnb','Airbnb','Listing videos','web','#F97316','globe',NULL,'["airbnb.com"]','https://airbnb.com/','airbnb-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('agoda','Agoda','Hotel videos','web','#EAB308','globe',NULL,'["agoda.com"]','https://agoda.com/','agoda-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('expedia','Expedia','Hotel videos','web','#22C55E','globe',NULL,'["expedia.com"]','https://expedia.com/','expedia-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('skyscanner','Skyscanner','Travel videos','web','#14B8A6','globe',NULL,'["skyscanner.com", "skyscanner.net"]','https://skyscanner.com/','skyscanner-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('tripadvisor','Tripadvisor','Traveller videos','web','#06B6D4','globe',NULL,'["tripadvisor.com"]','https://tripadvisor.com/','tripadvisor-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('paypal','PayPal','Invoice & receipt media','web','#64748B','globe',NULL,'["paypal.com"]','https://paypal.com/','paypal-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('stripe','Stripe','Dashboard media','web','#2563EB','globe',NULL,'["stripe.com"]','https://stripe.com/','stripe-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('wise','Wise','Transfer media','web','#0EA5E9','globe',NULL,'["wise.com"]','https://wise.com/','wise-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('payoneer','Payoneer','Account media','web','#6366F1','globe',NULL,'["payoneer.com"]','https://payoneer.com/','payoneer-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('skrill','Skrill','Account media','web','#8B5CF6','globe',NULL,'["skrill.com"]','https://skrill.com/','skrill-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('easypaisa','Easypaisa','Receipt media','web','#EC4899','globe',NULL,'["easypaisa.com.pk"]','https://easypaisa.com.pk/','easypaisa-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('jazzcash','JazzCash','Receipt media','web','#F43F5E','globe',NULL,'["jazzcash.com.pk"]','https://jazzcash.com.pk/','jazzcash-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('sadapay','SadaPay','Receipt media','web','#F97316','globe',NULL,'["sadapay.pk"]','https://sadapay.pk/','sadapay-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('nayapay','NayaPay','Receipt media','web','#EAB308','globe',NULL,'["nayapay.com"]','https://nayapay.com/','nayapay-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('google_pay','Google Pay','Receipt media','web','#22C55E','globe',NULL,'["pay.google.com"]','https://pay.google.com/','google-pay-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('zapier','Zapier','Automation demos','web','#14B8A6','globe',NULL,'["zapier.com"]','https://zapier.com/','zapier-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('make','Make','Automation demos','web','#06B6D4','globe',NULL,'["make.com"]','https://make.com/','make-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('n8n','n8n','Automation demos','web','#64748B','globe',NULL,'["n8n.io"]','https://n8n.io/','n8n-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('ifttt','IFTTT','Automation demos','web','#2563EB','globe',NULL,'["ifttt.com"]','https://ifttt.com/','ifttt-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('microsoft_power_automate','Microsoft Power Automate','Automation demos','web','#0EA5E9','globe',NULL,'["powerautomate.microsoft.com"]','https://powerautomate.microsoft.com/','microsoft-power-automate-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('pipedream','Pipedream','Automation demos','web','#6366F1','globe',NULL,'["pipedream.com"]','https://pipedream.com/','pipedream-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('activepieces','Activepieces','Automation demos','web','#8B5CF6','globe',NULL,'["activepieces.com"]','https://activepieces.com/','activepieces-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('node_red','Node-RED','Automation demos','web','#EC4899','globe',NULL,'["nodered.org"]','https://nodered.org/','node-red-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('uipath','UiPath','RPA demos','web','#F43F5E','globe',NULL,'["uipath.com"]','https://uipath.com/','uipath-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('unsplash','Unsplash','Free photos & video','web','#F97316','globe',NULL,'["unsplash.com"]','https://unsplash.com/','unsplash-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('pexels','Pexels','Free photos & video','web','#EAB308','globe',NULL,'["pexels.com"]','https://pexels.com/','pexels-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('pixabay','Pixabay','Free photos, video & audio','web','#22C55E','globe',NULL,'["pixabay.com"]','https://pixabay.com/','pixabay-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('shutterstock','Shutterstock','Stock previews','web','#14B8A6','globe',NULL,'["shutterstock.com"]','https://shutterstock.com/','shutterstock-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('adobe_stock','Adobe Stock','Stock previews','web','#06B6D4','globe',NULL,'["stock.adobe.com"]','https://stock.adobe.com/','adobe-stock-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('getty_images','Getty Images','Stock previews','web','#64748B','globe',NULL,'["gettyimages.com"]','https://gettyimages.com/','getty-images-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('istock','iStock','Stock previews','web','#2563EB','globe',NULL,'["istockphoto.com"]','https://istockphoto.com/','istock-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('envato_elements','Envato Elements','Template previews','web','#0EA5E9','globe',NULL,'["elements.envato.com", "envato.com"]','https://elements.envato.com/','envato-elements-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('motion_array','Motion Array','Template previews','web','#6366F1','globe',NULL,'["motionarray.com"]','https://motionarray.com/','motion-array-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('storyblocks','Storyblocks','Stock previews','web','#8B5CF6','globe',NULL,'["storyblocks.com"]','https://storyblocks.com/','storyblocks-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('obs_studio','OBS Studio','Recording guides & media','web','#EC4899','globe',NULL,'["obsproject.com"]','https://obsproject.com/','obs-studio-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('streamlabs','Streamlabs','Stream clips','web','#F43F5E','globe',NULL,'["streamlabs.com"]','https://streamlabs.com/','streamlabs-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('ffmpeg','FFmpeg','Documentation media','web','#F97316','globe',NULL,'["ffmpeg.org"]','https://ffmpeg.org/','ffmpeg-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z'),
('handbrake','HandBrake','Encoding guides','web','#EAB308','globe',NULL,'["handbrake.fr"]','https://handbrake.fr/','handbrake-video-downloader',0,0,1,1,1,1,'operational','','2026-01-01T00:00:00.000Z');

CREATE TABLE `ad_waterfall_zones` (
  `zone_key` VARCHAR(64) PRIMARY KEY,
  `enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `cooldown_minutes` INT NOT NULL DEFAULT 20,
  `config_json` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `system_settings` (
  `setting_key` VARCHAR(64) PRIMARY KEY,
  `setting_json` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `saved_vault_videos` (
  `id` VARCHAR(64) PRIMARY KEY,
  `website_id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `source_url` TEXT NOT NULL,
  `stream_url` TEXT NOT NULL,
  `local_file_path` TEXT NULL,
  `thumbnail_url` TEXT NOT NULL,
  `platform_id` VARCHAR(64) NOT NULL,
  `platform_json` LONGTEXT NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `duration_text` VARCHAR(64) NOT NULL,
  `resolution_label` VARCHAR(64) NOT NULL,
  `file_size_bytes` BIGINT NOT NULL DEFAULT 0,
  `file_present_on_disk` TINYINT(1) NOT NULL DEFAULT 1,
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `is_adult` TINYINT(1) NOT NULL DEFAULT 0,
  `admin_notes` TEXT NULL,
  `saved_at` VARCHAR(64) NOT NULL,
  INDEX `idx_vault_site_saved` (`website_id`, `saved_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `finance_ledger` (
  `id` VARCHAR(64) PRIMARY KEY,
  `website_id` VARCHAR(64) NOT NULL,
  `website_label` VARCHAR(191) NOT NULL,
  `entry_type` VARCHAR(32) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `amount` DOUBLE NOT NULL,
  `status` VARCHAR(64) NOT NULL DEFAULT 'RECORDED',
  `entry_date` VARCHAR(32) NOT NULL,
  `notes` TEXT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  INDEX `idx_ledger_site_date` (`website_id`, `entry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `seo_keywords` (
  `id` VARCHAR(64) PRIMARY KEY,
  `keyword` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(191) NOT NULL UNIQUE,
  `impressions` INT NOT NULL DEFAULT 0,
  `clicks` INT NOT NULL DEFAULT 0,
  `created_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `encrypted_cookies` (
  `id` VARCHAR(64) PRIMARY KEY,
  `platform_label` VARCHAR(191) NOT NULL,
  `platform_id` VARCHAR(64) NOT NULL,
  `iv_hex` VARCHAR(64) NOT NULL,
  `auth_tag_hex` VARCHAR(64) NOT NULL,
  `ciphertext_hex` LONGTEXT NOT NULL,
  `masked_preview` VARCHAR(191) NOT NULL,
  `status` VARCHAR(64) NOT NULL DEFAULT 'Active',
  `updated_at` VARCHAR(64) NOT NULL,
  INDEX `idx_cookie_platform` (`platform_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `download_jobs` (
  `id` VARCHAR(64) PRIMARY KEY,
  `requester_ip` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NULL,
  `title` VARCHAR(512) NOT NULL,
  `file_name` VARCHAR(512) NOT NULL,
  `source_url` TEXT NOT NULL,
  `format_selector` TEXT NOT NULL,
  `stream_url` TEXT NULL,
  `local_output_path` TEXT NULL,
  `thumbnail_url` TEXT NULL,
  `platform_id` VARCHAR(64) NOT NULL,
  `quality_label` VARCHAR(64) NOT NULL,
  `format_ext` VARCHAR(16) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `progress_pct` DOUBLE NOT NULL DEFAULT 0,
  `bytes_downloaded` BIGINT NOT NULL DEFAULT 0,
  `total_bytes` BIGINT NOT NULL DEFAULT 0,
  `speed_bps` BIGINT NOT NULL DEFAULT 0,
  `eta_seconds` INT NOT NULL DEFAULT 0,
  `error_message` TEXT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  INDEX `idx_dl_ip_created` (`requester_ip`, `created_at`),
  INDEX `idx_dl_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `share_links` (
  `short_code` VARCHAR(32) PRIMARY KEY,
  `source_url` TEXT NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `platform_id` VARCHAR(64) NOT NULL,
  `thumbnail_url` TEXT NULL,
  `duration_text` VARCHAR(64) NULL,
  `stream_url` TEXT NOT NULL,
  `views` INT NOT NULL DEFAULT 0,
  `created_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `analytics_events` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `website_id` VARCHAR(64) NOT NULL,
  `event_name` VARCHAR(64) NOT NULL,
  `platform_id` VARCHAR(64) NULL,
  `meta_json` LONGTEXT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  INDEX `idx_events_web_event` (`website_id`, `event_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `security_audit_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `event_type` VARCHAR(64) NOT NULL,
  `ip_address` VARCHAR(64) NOT NULL,
  `user_agent` VARCHAR(255) NULL,
  `details_text` VARCHAR(500) NULL,
  `created_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Round-10 MONETISATION: ad slots + real event ledger + hashed visitors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ad_slots` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `slot_key` varchar(64) NOT NULL,
  `name` varchar(120) NOT NULL,
  `placement` varchar(32) NOT NULL DEFAULT 'inline',
  `ad_type` varchar(24) NOT NULL DEFAULT 'house',
  `headline` varchar(160) DEFAULT NULL,
  `body` varchar(300) DEFAULT NULL,
  `cta_text` varchar(40) DEFAULT NULL,
  `target_url` varchar(400) DEFAULT NULL,
  `image_url` varchar(600) DEFAULT NULL,
  `adsense_client` varchar(40) DEFAULT NULL,
  `adsense_slot` varchar(40) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `weight` int(11) NOT NULL DEFAULT 10,
  `created_at` varchar(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_slot_key` (`slot_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ad_events` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `slot_key` varchar(64) NOT NULL,
  `event_type` varchar(16) NOT NULL,
  `ip_hash` varchar(64) DEFAULT NULL,
  `user_agent` varchar(250) DEFAULT NULL,
  `page_path` varchar(250) DEFAULT NULL,
  `revenue_usd` decimal(10,6) NOT NULL DEFAULT 0.000000,
  `created_at` varchar(40) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_slot` (`slot_key`),
  KEY `idx_type` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `visitor_sessions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `ip_hash` varchar(64) NOT NULL,
  `user_agent` varchar(250) DEFAULT NULL,
  `country` varchar(60) DEFAULT NULL,
  `first_seen` varchar(40) NOT NULL,
  `last_seen` varchar(40) NOT NULL,
  `hits` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_ip_hash` (`ip_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



INSERT INTO `websites` VALUES ('site_main_clean', 'UltraDownloader Main Hub', 'localhost:5173', 'clean_mainstream', 'ACTIVE', 0, 0, 100, '2026-10-23T00:00:00.000Z');
INSERT INTO `admin_users` VALUES ('admin-master-01', 'shakeeladminprod', 'shakeelaijaz559986@gmail.com', 'Shakeel Ahmed — Super Admin', '$2a$12$1V2d0LzQirqg9w6m6c2bjucblPUkP7CRVdZX34gWxzLFC0jjWOqSK', '$2a$12$s9ojfbUcu3UxF1fTLnTDBuDMKXbwM3HhuIoB80iAUpmuFuSDQ4vgS', 'JBSWY3DPEHPK3PXP', 'super_admin', NULL, '2026-10-23T00:00:00.000Z')
ON DUPLICATE KEY UPDATE username = VALUES(username), email = VALUES(email), full_name = VALUES(full_name), password_hash = VALUES(password_hash), pin_hash = VALUES(pin_hash);

INSERT INTO `seo_keywords` VALUES ('seo-youtube', 'YouTube Video Downloader', 'youtube-4k-video-mp3-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-tiktok', 'TikTok Video Downloader', 'tiktok-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-instagram', 'Instagram Video Downloader', 'instagram-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-facebook', 'Facebook Watch Video Downloader', 'facebook-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-twitter_x', 'X (Twitter) Video Downloader', 'twitter-x-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-reddit', 'Reddit Video Video Downloader', 'reddit-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-pinterest', 'Pinterest Video Downloader', 'pinterest-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-snapchat', 'Snapchat Spotlight Video Downloader', 'snapchat-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-linkedin', 'LinkedIn Video Video Downloader', 'linkedin-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-threads', 'Meta Threads Video Downloader', 'threads-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-telegram', 'Telegram Public Video Downloader', 'telegram-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-vk_video', 'VK Video Video Downloader', 'vk-video-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-tumblr', 'Tumblr Media Video Downloader', 'tumblr-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-bluesky', 'Bluesky Social Video Downloader', 'bluesky-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-rednote', 'RedNote (Xiaohongshu) Video Downloader', 'rednote-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-lemon8', 'Lemon8 Video Video Downloader', 'lemon8-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-kwai', 'SnackVideo / Kwai Video Downloader', 'kwai-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-likee', 'Likee Video Video Downloader', 'likee-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-weibo', 'Weibo Video Video Downloader', 'weibo-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-douyin', 'Douyin HD Video Downloader', 'douyin-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-mastodon', 'Mastodon Social Video Downloader', 'mastodon-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-fmoviesse', 'FMovies SE Video Downloader', 'fmoviesse-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-myfreemovies', 'MyFreeMovies Video Downloader', 'myfreemovies-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-rottentomatoes', 'Rotten Tomatoes Video Downloader', 'rottentomatoes-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-hotsflix', 'HotsFlix Video Downloader', 'hotsflix-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-fmovies_org', 'FMovies Org Video Downloader', 'fmovies-org-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-fawesome_tv', 'Fawesome TV Video Downloader', 'fawesome-tv-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-shemaroome', 'ShemarooMe Free Video Downloader', 'shemaroome-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-watch_movies_pk_2025', 'Watch-Movies PK (2025) Video Downloader', 'watch-movies-pk-2025-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-watch_movies_pk', 'Watch-Movies.com.pk Video Downloader', 'watch-movies-pk-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-movies123_go4u', '123MoviesGo4U Video Downloader', 'movies123-go4u-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-mewatch_sg', 'mewatch Movies Video Downloader', 'mewatch-sg-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-onlinemovies7', 'OnlineMovies7 Video Downloader', 'onlinemovies7-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-tubi_tv', 'Tubi TV Free Video Downloader', 'tubi-tv-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-moviesfoundonline', 'MoviesFoundOnline Video Downloader', 'moviesfoundonline-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-media_io_movies', 'Media.io Movie Hub Video Downloader', 'media-io-movies-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-sunnxt_free', 'Sun NXT Free Video Downloader', 'sunnxt-free-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-vimeo', 'Vimeo 4K Video Downloader', 'vimeo-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-dailymotion', 'Dailymotion HD Video Downloader', 'dailymotion-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-twitch', 'Twitch VOD & Clips Video Downloader', 'twitch-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-kick', 'Kick Streams Video Downloader', 'kick-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-rumble', 'Rumble 4K Video Downloader', 'rumble-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-bilibili', 'Bilibili Anime & Film Video Downloader', 'bilibili-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-odysee', 'Odysee Cinema Video Downloader', 'odysee-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-bitchute', 'BitChute Video Video Downloader', 'bitchute-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-archive_cinema', 'Internet Archive Films Video Downloader', 'archive-cinema-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-ok_ru_movies', 'OK.ru Full Movies Video Downloader', 'ok-ru-movies-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-soundcloud', 'SoundCloud Studio Video Downloader', 'soundcloud-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-peertube', 'PeerTube / Framatube Video Downloader', 'peertube-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-plex_free', 'Plex Free Movies Video Downloader', 'plex-free-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-pluto_tv', 'Pluto TV Clips Video Downloader', 'pluto-tv-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-mx_player', 'MX Player Free Video Downloader', 'mx-player-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-ary_zap_pk', 'Pakistani Drama Portals Video Downloader', 'ary-zap-pk-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-direct_hls', 'Direct MP4 / MKV / M3U8 Video Downloader', 'direct-hls-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-coursera', 'Coursera (Free & Enrolled) Video Downloader', 'coursera-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-udemy', 'Udemy (Open & Enrolled) Video Downloader', 'udemy-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-edx', 'edX University Courses Video Downloader', 'edx-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-mit_ocw', 'MIT OpenCourseWare Video Downloader', 'mit-ocw-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-harvard_cs50', 'Harvard CS50 Portal Video Downloader', 'harvard-cs50-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-khan_academy', 'Khan Academy Video Downloader', 'khan-academy-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-freecodecamp', 'freeCodeCamp.org Video Downloader', 'freecodecamp-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-nptel_swayam', 'NPTEL / SWAYAM Video Downloader', 'nptel-swayam-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-vu_pakistan', 'Virtual University PK Video Downloader', 'vu-pakistan-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-digiskills_pk', 'DigiSkills Pakistan Video Downloader', 'digiskills-pk-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-stanford_online', 'Stanford Online Video Downloader', 'stanford-online-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-yale_courses', 'Open Yale Courses Video Downloader', 'yale-courses-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-ted_talks', 'TED Talks & TED-Ed Video Downloader', 'ted-talks-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-linkedin_learning', 'LinkedIn Learning Video Downloader', 'linkedin-learning-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-skillshare', 'Skillshare Classes Video Downloader', 'skillshare-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-pluralsight', 'Pluralsight Tech Video Downloader', 'pluralsight-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-teachable', 'Teachable Courses Video Downloader', 'teachable-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-thinkific', 'Thinkific Academy Video Downloader', 'thinkific-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-kajabi', 'Kajabi Creator Courses Video Downloader', 'kajabi-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-skool_classroom', 'Skool Classroom Video Downloader', 'skool-classroom-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-podia', 'Podia Courses Video Downloader', 'podia-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-gumroad_courses', 'Gumroad Video Tutorials Video Downloader', 'gumroad-courses-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-domestika', 'Domestika Creative Video Downloader', 'domestika-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-hotmart_club', 'Hotmart Academy Video Downloader', 'hotmart-club-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-loom_lectures', 'Loom Class Recordings Video Downloader', 'loom-lectures-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-panopto', 'Panopto University LMS Video Downloader', 'panopto-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-kaltura_edu', 'Kaltura Campus Media Video Downloader', 'kaltura-edu-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-echo360', 'Echo360 Lecture Capture Video Downloader', 'echo360-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-zoom_cloud', 'Zoom Cloud Recordings Video Downloader', 'zoom-cloud-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-bigbluebutton', 'BigBlueButton LMS Video Downloader', 'bigbluebutton-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-alison_openlearn', 'OpenLearn & Alison Video Downloader', 'alison-openlearn-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-laracasts_scrimba', 'Laracasts & Dev Casts Video Downloader', 'laracasts-scrimba-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-terabox_app', 'TeraBox.app (Official) Video Downloader', 'terabox-app-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-terabox_com', 'TeraBox.com Video Downloader', 'terabox-com-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-teraviralhub', 'TeraViralHub.com Video Downloader', 'teraviralhub-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-iteraplay_free', 'iTeraPlay.com (Free Engine) Video Downloader', 'iteraplay-free-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-mirrobox', 'MirroBox (ww & www) Video Downloader', 'mirrobox-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-nephobox', 'NephoBox.com Video Downloader', 'nephobox-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-freeterabox', 'FreeTeraBox.com Video Downloader', 'freeterabox-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-tera1024', '1024Tera (.com & .co) Video Downloader', 'tera1024-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-funbox4', '4FunBox (.com & .co) Video Downloader', 'funbox4-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-momerybox', 'MomeryBox.com Video Downloader', 'momerybox-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-tibibox', 'TibiBox.com Video Downloader', 'tibibox-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-terabox_fun', 'TeraBox.fun Video Downloader', 'terabox-fun-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-teraboxapp_com', 'TeraBoxApp.com Video Downloader', 'teraboxapp-com-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-terabox1024', '1024TeraBox.com Video Downloader', 'terabox1024-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-terasharelink', 'TeraShareLink.com Video Downloader', 'terasharelink-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-terasharefile', 'TeraShareFile.com Video Downloader', 'terasharefile-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-terafileshare', 'TeraFileShare.com Video Downloader', 'terafileshare-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-teraboxlink', 'TeraBoxLink & URL Video Downloader', 'teraboxlink-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-gdrive', 'Google Drive Public Video Downloader', 'gdrive-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-mediafire', 'MediaFire Cloud Video Downloader', 'mediafire-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-dropbox', 'Dropbox Shared Video Video Downloader', 'dropbox-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-onedrive_share', 'OneDrive Shared Link Video Downloader', 'onedrive-share-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-pixeldrain', 'PixelDrain Cloud Video Downloader', 'pixeldrain-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-gofile_io', 'GoFile.io Cloud Video Downloader', 'gofile-io-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-streamtape', 'Streamtape Cloud Video Downloader', 'streamtape-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-doodstream', 'DoodStream / MyVidPlay Video Downloader', 'doodstream-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-mixdrop', 'MixDrop Cloud Video Downloader', 'mixdrop-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-voe_cloud', 'VOE.sx Cloud Video Downloader', 'voe-cloud-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-filemoon', 'FileMoon HD Cloud Video Downloader', 'filemoon-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-krakenfiles', 'KrakenFiles Audio/Video Video Downloader', 'krakenfiles-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-pcloud_yandex', 'pCloud & Yandex Disk Video Downloader', 'pcloud-yandex-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');
INSERT INTO `seo_keywords` VALUES ('seo-sendvid_cloud', 'SendVid & Catbox Video Downloader', 'sendvid-cloud-video-downloader', 0, 0, '2026-10-23T00:00:00.000Z');

INSERT INTO `ad_slots` (`slot_key`,`name`,`placement`,`ad_type`,`headline`,`body`,`cta_text`,`target_url`,`image_url`,`adsense_client`,`adsense_slot`,`is_active`,`weight`,`created_at`) VALUES
('header_banner','Header Leaderboard','header','house','Download any video in one click','No software, no sign-up, HD quality.','Try it now','/','','','',1,10,'2026-01-01T00:00:00.000Z'),
('below_player','Below Player Billboard','belowPlayer','adsense','','','','','','','',0,10,'2026-01-01T00:00:00.000Z'),
('sidebar_rail','Sidebar Rail','sidebar','house','Unlimited HD downloads','TeraBox, YouTube, Instagram, 400+ sites.','Start free','/','','','',1,8,'2026-01-01T00:00:00.000Z'),
('inline_supported','In-feed (Supported Sites)','inline','house','Save videos offline forever','Full HD 1080p and 4K, MP3 for audio only.','Browse sites','/sites','','','',1,6,'2026-01-01T00:00:00.000Z'),
('footer_banner','Footer Banner','footer','house','Free forever','No registration needed for downloads.','Start','/','','','',0,4,'2026-01-01T00:00:00.000Z');

INSERT INTO `ad_waterfall_zones` VALUES ('native_banner', 0, 20, '{"enabled":false,"title":"","subtitle":"","ctaText":"Visit Partner","targetUrl":""}', '2026-10-23T00:00:00.000Z');
INSERT INTO `ad_waterfall_zones` VALUES ('player_preroll_vast', 0, 20, '{"enabled":false,"skipAfterSeconds":4,"sponsorBrand":"","headline":""}', '2026-10-23T00:00:00.000Z');
INSERT INTO `ad_waterfall_zones` VALUES ('download_click_direct_tab', 0, 20, '{"enabled":false,"cooldownMinutes":20,"triggerMode":"on_download_click","directUrl":""}', '2026-10-23T00:00:00.000Z');
INSERT INTO `ad_waterfall_zones` VALUES ('progress_modal_sponsor', 0, 20, '{"enabled":false,"title":"","subtitle":""}', '2026-10-23T00:00:00.000Z');
INSERT INTO `system_settings` VALUES ('global', '{"guestDailyDownloadLimit":50,"userDailyDownloadLimit":500,"guestMaxFileSizeMb":8192,"vaultMaxStorageGb":200,"allowAdultSources":true,"storageGateMode":"three_button_admin_gate","idmConnections":16,"dnsOverHttpsBypass":true,"autoUnwrapIteraplay":true}', '2026-10-23T00:00:00.000Z');
