/* X の GraphQL レスポンス（Bookmarks / BookmarkFoldersSlice）の防御的パーサ。
   解析できないエントリは捨てて、決して投げない。 */
(function (G) {
  'use strict';
  var XBS = (G.XBS = G.XBS || {});

  function dec(s) {
    return String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
  function unwrap(r) {
    var n = 0;
    while (r && typeof r === 'object' && n++ < 4) {
      if (r.__typename === 'TweetWithVisibilityResults' && r.tweet) r = r.tweet;
      else if (r.tweet && !r.legacy && !r.rest_id) r = r.tweet;
      else break;
    }
    return r;
  }
  function deepFind(root, key, maxNodes) {
    var q = [root], seen = 0;
    while (q.length && seen++ < (maxNodes || 6000)) {
      var o = q.shift();
      if (!o || typeof o !== 'object') continue;
      if (Array.isArray(o[key])) return o[key];
      var ks = Object.keys(o);
      for (var i = 0; i < ks.length; i++) { var v = o[ks[i]]; if (v && typeof v === 'object') q.push(v); }
    }
    return null;
  }
  function findInstructions(json) {
    var d = json && json.data, c = [];
    if (d) {
      ['bookmark_timeline_v2', 'bookmark_collection_timeline', 'bookmark_timeline'].forEach(function (k) {
        if (d[k] && d[k].timeline) c.push(d[k].timeline);
      });
    }
    for (var i = 0; i < c.length; i++) if (c[i] && Array.isArray(c[i].instructions)) return c[i].instructions;
    return deepFind(json, 'instructions') || [];
  }

  function fmtUrl(u) { return String(u || ''); }

  function normalize(result, depth) {
    try {
      result = unwrap(result);
      if (!result || typeof result !== 'object') return null;
      if (result.__typename === 'TweetTombstone' || result.__typename === 'TweetUnavailable') return null;
      var leg = result.legacy;
      if (!leg) return null;
      var id = String(result.rest_id || leg.id_str || '');
      if (!id) return null;

      // ユーザー（新旧どちらの形でも）
      var ur = result.core && result.core.user_results && unwrap(result.core.user_results.result) || {};
      var ul = ur.legacy || {};
      var uc = ur.core || {};
      var name = uc.name || ul.name || '';
      var screen = uc.screen_name || ul.screen_name || '';
      var avatar = (ur.avatar && ur.avatar.image_url) || ul.profile_image_url_https || '';
      avatar = avatar.replace('_normal.', '_bigger.');

      // 本文：note_tweet（長文）を優先
      var text = leg.full_text || '';
      var entUrls = (leg.entities && leg.entities.urls) || [];
      var isNote = false;
      var nt = result.note_tweet && result.note_tweet.note_tweet_results && result.note_tweet.note_tweet_results.result;
      if (nt && nt.text) {
        text = nt.text; isNote = true;
        entUrls = (nt.entity_set && nt.entity_set.urls) || entUrls;
      }
      var media = (leg.extended_entities && leg.extended_entities.media) || (leg.entities && leg.entities.media) || [];
      text = dec(text);
      entUrls.forEach(function (u) {
        if (u && u.url && u.expanded_url) text = text.split(u.url).join(u.expanded_url);
      });
      media.forEach(function (m) { if (m && m.url) text = text.split(m.url).join(''); });
      if (leg.quoted_status_permalink && leg.quoted_status_permalink.url) {
        text = text.split(leg.quoted_status_permalink.url).join('');
      }
      text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

      var out = {
        id: id, name: name, screen: screen, avatar: avatar,
        verified: !!(ur.is_blue_verified || ul.verified),
        text: text, isNote: isNote,
        createdAt: leg.created_at ? (Date.parse(leg.created_at) || 0) : 0,
        media: [], quote: null,
        counts: {
          reply: leg.reply_count || 0,
          repost: (leg.retweet_count || 0) + (leg.quote_count || 0),
          like: leg.favorite_count || 0
        },
        url: 'https://x.com/' + (screen || 'i') + '/status/' + id
      };
      media.forEach(function (m) {
        if (!m || !m.media_url_https) return;
        var oi = m.original_info || {};
        var type = m.type === 'video' ? 'video' : m.type === 'animated_gif' ? 'gif' : 'photo';
        out.media.push({ type: type, url: fmtUrl(m.media_url_https), w: oi.width || 0, h: oi.height || 0 });
      });
      if (!depth && result.quoted_status_result && result.quoted_status_result.result) {
        var q = normalize(result.quoted_status_result.result, 1);
        if (q) out.quote = q;
      }
      return out;
    } catch (e) {
      return null;
    }
  }

  function bookmarks(json) {
    var items = [], cursor = null, entriesSeen = 0;
    try {
      var ins = findInstructions(json);
      var entries = [];
      ins.forEach(function (i) {
        if (!i) return;
        if (Array.isArray(i.entries)) entries = entries.concat(i.entries);
        if (i.entry) entries.push(i.entry);
      });
      entries.forEach(function (e) {
        try {
          var c = e && e.content;
          if (!c) return;
          entriesSeen++;
          if (c.cursorType || c.entryType === 'TimelineTimelineCursor') {
            if (c.cursorType === 'Bottom') cursor = c.value || cursor;
            return;
          }
          var ic = c.itemContent || (c.items && c.items[0] && c.items[0].item && c.items[0].item.itemContent);
          var r = ic && ic.tweet_results && ic.tweet_results.result;
          var it = r && normalize(r, 0);
          if (it) { it.sortIndex = e.sortIndex || ''; items.push(it); }
        } catch (e2) { /* 捨てる */ }
      });
    } catch (e) { /* 捨てる */ }
    return { items: items, cursor: cursor, empty: items.length === 0 };
  }

  function folders(json) {
    var q = [json], seen = 0;
    while (q.length && seen++ < 6000) {
      var o = q.shift();
      if (!o || typeof o !== 'object') continue;
      if (Array.isArray(o.items) && o.items.length && o.items[0] && typeof o.items[0].id === 'string' && typeof o.items[0].name === 'string') {
        return o.items.filter(function (f) { return f && f.id && f.name; }).map(function (f) { return { id: String(f.id), name: String(f.name) }; });
      }
      var ks = Object.keys(o);
      for (var i = 0; i < ks.length; i++) { var v = o[ks[i]]; if (v && typeof v === 'object') q.push(v); }
    }
    return [];
  }

  XBS.parse = { bookmarks: bookmarks, folders: folders, normalize: normalize };
})(typeof globalThis !== 'undefined' ? globalThis : window);
