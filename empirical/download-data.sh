rm -rf ./data/ &&
mkdir data &&
curl -o ./data/easylist.txt 'https://easylist.to/easylist/easylist.txt' \
  -H 'authority: easylist.to' \
  -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
  -H 'accept-language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'cache-control: max-age=0' \
  -H 'if-modified-since: Wed, 26 Apr 2023 15:13:31 GMT' \
  -H 'if-none-match: W/"64493f9b-159095"' \
  -H 'referer: https://easylist.to/' \
  -H 'sec-ch-ua: "Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: document' \
  -H 'sec-fetch-mode: navigate' \
  -H 'sec-fetch-site: same-origin' \
  -H 'sec-fetch-user: ?1' \
  -H 'upgrade-insecure-requests: 1' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' \
  --compressed &&
curl -o ./data/easyprivacy.txt 'https://easylist.to/easylist/easyprivacy.txt' \
  -H 'authority: easylist.to' \
  -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
  -H 'accept-language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'referer: https://easylist.to/' \
  -H 'sec-ch-ua: "Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: document' \
  -H 'sec-fetch-mode: navigate' \
  -H 'sec-fetch-site: same-origin' \
  -H 'sec-fetch-user: ?1' \
  -H 'upgrade-insecure-requests: 1' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' \
  --compressed &&
rm -rf abp2blocklist &&
git clone https://github.com/adblockplus/abp2blocklist &&
cd abp2blocklist &&
npm install &&
node abp2blocklist.js < ../data/easylist.txt > ../data/easylist.block.json &&
node abp2blocklist.js < ../data/easyprivacy.txt > ../data/easyprivacy.block.json &&
cd - &&
rm -rf abp2blocklist
