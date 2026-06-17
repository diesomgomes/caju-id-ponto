#!/bin/sh
cat > /usr/share/nginx/html/config.js <<EOF
window.__API_URL__ = '${API_URL}';
window.__SUPABASE_URL__ = '${SUPABASE_URL}';
window.__SUPABASE_ANON_KEY__ = '${SUPABASE_ANON_KEY}';
EOF
exec nginx -g "daemon off;"
