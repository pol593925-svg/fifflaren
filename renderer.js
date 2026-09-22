const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby1q1rhdewBwtjCGPQ9g7g_HaruhPYxovLQRbAuXQyV8GIyNY5suZpxXn_hJSrRoLbt/exec";
const SERVER_API_URL = "https://support-hub-server.onrender.com";
const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');
const { io } = require("socket.io-client");

const notesFilePath = path.join(process.cwd(), 'notes.txt');

let socket = null;
let timerInterval = null, startTimeMs = null, startTimeStr = "", count = 0, isWorking = false;

// --- СПРАВОЧНИК БИРЖ ---
const exchangesYes = [
  "1xBet", "3commas", "aarman.com", "account.bcx.ba", "ACY.COM", "altex.mn", "app.airtm.com", "app.btcmarkets.net", "app.simplefx.com", "arbitrageth", "ascendex.com", "astekbet.com", "ATX", "axieinfinity.com", "axiom.trade", "bc.game", "betfury.com", "betterx.io", "bikingex.com", "binance.com", "binance.info", "binance.me", "binance.th", "binance.tr", "bingx.com", "bitazza.com", "bitbank.cc", "bitcasino.io", "bitfinex.com", "bitget.com", "bitgo.com", "bitmart.com", "bitmex.com", "bitnet.ge", "bitopro", "bitpanda.com", "bitpoint", "bitqik.com", "bitrue", "bitso.com", "bitstamp.com", "bitstreetx", "bittradex", "bittworld.com", "bitunix.com", "blockchain.com", "blocktrade.com", "blofin.com", "btcc.com", "buda.com", "buenbit.com/", "bull-ex.com", "bybit.com", "bydfi.com", "bytick.com", "ceres-finance.com", "cex.io", "client.bitharvest.io", "coin.z.com", "coinbase.com", "coincheck", "coindepo.com", "coinex.com", "Coinext", "coinhako", "coinhub.mn", "Coinone", "coins.ph", "coinshub.mn", "coinspot.com", "coinstash.com.au", "coinstore.com", "cointree.com", "coinw.com", "Covest.pro", "crypsity.com", "cryptal.com", "crypto.com", "csgoempire.com", "cwallet.com", "decrypto.la", "Deribit", "digifinex", "digitalsurge.com.au", "easicoin", "efsanetr.com", "ether.fi", "exchange.fastex.com", "f2pool.com", "fcxtrade.com", "fiahub.com", "finandy.com", "fiwind.io", "fiybit.com", "flipster.io", "fortunomarkets.com", "fpmarkets.com", "fusionmarkets.com", "gamdom", "gate.io", "gemini.com", "globalprime.com", "hapiapp.com", "hashkey.com", "hata.io", "hotbit.com", "htfx.com", "https://attlas.io/", "https://bitflyer.com", "https://dzhlwk.com", "https://grvt.io/exchange/strategies", "https://hexn.io", "https://kms.kinesis.money/", "https://mycoins.ge/", "https://portal.blueberrymarkets.com", "https://safetrade.com/", "https://swyftx.com/", "https://weex.exchange", "https://www.alchemy.com/", "https://www.btse.com/", "https://www.independentreserve.com/", "https://www.mountainwolf.com", "https://www.zoomex.com/", "https://xpo.ru", "htx.com", "idax.com", "ijex.net/pc/#/home", "indodax.com", "KAST.com", "kraken.com", "kryptex.com", "kucoin.com", "latoken", "lazzaglobal.com", "lbank.com", "lobstr.co", "luno.com", "max.maicoin.com", "maxifyfx.com", "mercadobitcoin", "mercadobitcoin.com.br", "meru.com", "mexc.com", "mobee.io", "MOTFX", "multibankfx.com", "mystake", "nexo.com", "NiceHash", "noones.com", "novadax.com", "okx.com", "One royal", "opensea.io", "optgobroker.com", "orangex.com", "orbixtrade.com", "osl.com", "p2pb2b.com", "paribu", "paxfull", "pdax.ph", "phemex.com", "picnic.com", "Pinetwork", "pintu.co.id", "pionex.com", "pluang.com", "polaris-io.com", "poloniex.com", "polymarket", "portal.fxgt.com/", "Primefort", "primexbt.com", "probit.com", "quickswap.exchange", "redotpay", "reku.id", "remitano.com", "salepoint.io", "solcasino.io", "solflare", "strifor.biz", "sun.win", "tapbit.com", "tokenizemalaysia.com", "TokoCrypto", "toobit.com", "trade.50x.com", "tradequo.com", "TradeSilvania", "trading.bridgemarkets.global", "trading.quantfury.com", "ttx.vip", "Valr.com", "viabtc.com", "wazirx.com", "websea.com", "webtrader.kimonsage.co", "wefi.co", "whitebit.com", "whiteforex.com", "WOOX", "www.altcointrader.co.za/", "www.hotcoin.com/", "x-meta.com", "xchengeon.io", "XT.com", "yeet.com", "youholder.com", "yubit", "zaifjp.com", "eormc.id"
];

const exchangesCondition = [
  { name: "Alpari", condition: "Должны быть депы в крипте" },
  { name: "app.alpaca.markets", condition: "гео которые можно передавать\n\nAndorra\nAngola\nAntarctica\nAntigua and Barbuda\nArgentina\nArmenia\nAruba\nAustralia\nAzerbaijan\nBahamas\nBahrain\nBarbados\nBelize\nBenin\nBermuda\nBhutan\nBolivia (Plurinational State of)\nBonaire, Sint Eustatius and Saba\nBotswana\nBouvet Island\nBritish Indian Ocean Territory\nBrunei Darussalam\nBurkina Faso\nCambodia\nCameroon\nCape Verde\nCayman Islands\nChad\nChile\nChristmas Island\nCocos (Keeling Islands)\nColombia\nComoros\nCook Islands\nCosta Rica\nCuraçao\nDjibouti\nDominica\nDominican Republic\nEcuador\nEl Salvador\nEquatorial Guinea\nEritrea\nEthiopia\nFalkland Islands (Malvinas)\nFaroe Islands\nFiji\nFrench Guiana\nFrench Polynesia\nFrench Southern Territories\nGabon\nGambia\nGeorgia\nGhana\nGibraltar\nGreenland\nGrenada\nGuadeloupe\nGuam\nGuernsey\nGuyana\nHeard Island and McDonald Islands\nHoly See\nHonduras\nIndia\nIndonesia\nIsle of Man\nIsrael\nJamaica\nJapan\nJersey\nKazakhstan\nKenya\nKiribati\nKorea (Republic of)\nKyrgyzstan\nLao People's Democratic Republic\nLesotho\nMacau\nMadagascar\nMalawi\nMalaysia\nMaldives\nMarshall Islands\nMartinique\nMauritania\nMauritius\nMayotte\nMexico\nMicronesia (Federal States of)\nMonaco\nMongolia\nMontserrat\nNauru\nNew Caledonia\nNew Zealand\nNiue\nNorfolk Island\nNorthern Mariana Islands\nOman\nPapua New Guinea\nParaguay\nPeru\nPhilippines\nPitcairn Islands\nRwanda\nRéunion\nSaint Barthélemy\nSaint Helena, Ascension and Tristan da Cunha\nSaint Kitts and Nevis\nSaint Lucia\nSaint Martin (Dutch part)\nSaint Martin (French part)\nSaint Pierre and Miquelon\nSaint Vincent and the Grenadines\nSan Marino\nSao Tome and Principe\nSaudi Arabia\nSenegal\nSeychelles\nSierra Leone\nSolomon Islands\nSouth Africa\nSouth Georgia and the South Sandwich Islands\nSri Lanka\nSuriname\nSvalbard and Jan Mayen\nSwaziland\nSwitzerland\nTajikistan\nTimor-Leste\nTogo\nTokelau\nTonga\nTurkmenistan\nTurks and Caicos Islands\nTuvalu\nUnited Arab Emirates\nUnited Kingdom\nUnited States Minor Outlying Islands\nUruguay\nUzbekistan\nVanuatu\nVietnam\nVirgin Islands (British)\nVirgin Islands (U.S.)\nWallis and Futuna\nZambia\n" },
  { name: "app.cocos.capital", condition: "наличие у кх других бирж" },
  { name: "app.libertex.org", condition: "KYC verified" },
  { name: "Axi.com", condition: "крипто" },
  { name: "axitrade", condition: "депы в крипте" },
  { name: "bank", condition: "челленжи 25000" },
  { name: "bdswiss.com", condition: "выводы тем же методом что и депы" },
  { name: "binance.us", condition: "Если зарегано не на доки USA" },
  { name: "binomo.com/en-en", condition: "там условия вывод в крипту" },
  { name: "bithumb.com", condition: "условия- не подключен cacao talk" },
  { name: "bitkub", condition: "ПАСКЕЙ не должен стоять / GOOGLE PASSWORD MANAGER" },
  { name: "Blackbull.com", condition: "вывод только на тот метод, с которого ты депал" },
  { name: "Btcdana.com", condition: "надо что бы кх депал с крипты" },
  { name: "BtcTurk", condition: "НАЛИЧИЕ ВТОРОГО УРОВНЯ ВЕРИФА" },
  { name: "bullwaves", condition: "сколько деп столько вывод" },
  { name: "cap", condition: "вывод тем же способом что и деп" },
  { name: "castlemarket", condition: "тем же способом что и деп" },
  { name: "centfx.com", condition: "На кош с которого депали точно лезет через день, на другие кошы ещё не пробовали" },
  { name: "clientportal.axi.com", condition: "вывод тем же способом что и деп" },
  { name: "connextfx.com", condition: "вывод только если в Payment Details есть крипто кош и он у нас есть ну или биржа с кототрой выводим" },
  { name: "cp.neex.com", condition: "деп в крипте" },
  { name: "crm.rs-fin.com", condition: "Скорее всего депы в крипте. Может реджектнуть вывод и прислать письмо: Выбранная валюта вывода не соответствует доступным вариантам вывода средств с вашего счета.Пожалуйста, выберите канал вывода средств [MYR] для вашего запроса" },
  { name: "cxmdirect.com", condition: "деп крипто" },
  { name: "dafabet.com", condition: "" },
  { name: "dbgvn.com", condition: "Деп в крипте" },
  { name: "deel.com", condition: "" },
  { name: "deriv.com", condition: "deriv можна вывести а крипту только то что ты и депал" },
  { name: "direct.fxpro.group/en/wallet", condition: "деп в крипте(сколько депнув столько вивел)" },
  { name: "Dominio markets", condition: "депы в крипте." },
  { name: "dooprime.com", condition: "можно вывести в крипте только если кх депал в ней" },
  { name: "ecmarkets.com", condition: "крипто деп" },
  { name: "ExclusiveMarkets", condition: "депы в крипте." },
  { name: "exness.com", condition: "Если был депозит в крипте / если деньги с affiliate то можно также в крипте выводить" },
  { name: "Exnova", condition: "если ты депал с крипты с коша например то ты можешь вывести только ту сумму которую депнул и только туда от куда депнул" },
  { name: "ezinvest.com", condition: "сверить кош с андр студио где указано(мигрировано)в пи скане меин нете" },
  { name: "fbs.com", condition: "Можно вывести то что депалось с крипты" },
  { name: "FundingPips", condition: "челенджи, вывод в крипту возможен но при условии что к наторговал в + на челлендже (2-3 успешно выполненных челенджа)" },
  { name: "Gmimarkets", condition: "dep crypto" },
  { name: "gntcapital.com", condition: "деп в крипте" },
  { name: "goonus.io", condition: "Если доступны к свапу VNDC" },
  { name: "grandcapital.net", condition: "dep crypto" },
  { name: "hfm.com", condition: "деп крипта (Вывод по тотп + апрув по почте )" },
  { name: "hmarkets.com", condition: "Добавлю с условием Вывод возможно в том же обьеме что и деп Деп должен быть в крипте" },
  { name: "https://app.mitrade.com/", condition: "" },
  { name: "https://fx.katoprime.com/", condition: "деп с крипты" },
  { name: "https://my.metadoro.com", condition: "Должны быть выполнены челенджи https://trader.spiceprop.org/(основная где балик челенджы)" },
  { name: "https://my.motforex.com", condition: "" },
  { name: "https://neuronmarkets.com", condition: "вывод тем же способом что и депался" },
  { name: "https://rf-zone.rebelsfunding.com/", condition: "rebelsfunding - 80к челендж как и rf-trader" },
  { name: "https://www.owmarkets.com/", condition: "с условием деп в крипте" },
  { name: "https://www.vantagemarkets.com/", condition: "если депал с фиата и он в профите, то можно вывести часть на крипту" },
  { name: "https://yaitrading.pro", condition: "Можно вывести только то что депал в крипте" },
  { name: "icmarkets.com", condition: "dep crypto" },
  { name: "icmcapital", condition: "если бабки были заведены в виде крипты" },
  { name: "infinox", condition: "Деп в крипте и кош вывода с ФИО клиента" },
  { name: "iqoption", condition: "что бы был деп в крипте и был доступен вывод" },
  { name: "jdrsecurities.com", condition: "вывод тем же способом что и деп" },
  { name: "junomarkets.com", condition: "log pass \\ вывод в том что и деп" },
  { name: "justmarket.com", condition: "выводить можно только тем способом в котором он пополнял и с которым у него контракт" },
  { name: "kripto.btcturk.com", condition: "НАЛИЧИЕ ВТОРОГО УРОВНЯ ВЕРИФА" },
  { name: "LiteFinance", condition: "вывод тем же способом что и деп" },
  { name: "login-gm.atfx.com", condition: "вывод может осуществляться тем способом в котором был деп" },
  { name: "markets4you", condition: "можно вывести только то что депал в крипте" },
  { name: "metatrader", condition: "Это платформа на подобии MT4, тобиж поставщий терминалов, а не платформа для торговли" },
  { name: "monaxa.com", condition: "50 на 50" },
  { name: "monetamarkets.com", condition: "Деп в крипте" },
  { name: "mykvb.com", condition: "вывод в том что и дэп" },
  { name: "octabroker.com", condition: "тот же octafx, вывод есть, если депал в крипте" },
  { name: "octaFx", condition: "вывод возможен, только если депал в крипте" },
  { name: "olymptrade.com", condition: "деп с крипты/ профит" },
  { name: "oneroyal.com", condition: "деп крипто" },
  { name: "opofinance.com", condition: "" },
  { name: "pepperstone", condition: "крипто деп + проверять какой там вывод,чтобы не было вывода на его карту RAYAN 3/3" },
  { name: "Pocketoption", condition: "Только если депал с крипты" },
  { name: "portal.fortuneprime.com", condition: "выводв крипту при условии депа с крипты" },
  { name: "portal.tmgm.com", condition: "нужен деп в крипте" },
  { name: "puprime.com", condition: "вывод только на банк, если депнул в крипте вывести сможешь только то что депнул или наторговал" },
  { name: "quotex", condition: "деп в крипте" },
  { name: "qxbroker.com", condition: "dep crypto" },
  { name: "rf-trader", condition: "rebelsfunding - 80к челендж как и rf-trader" },
  { name: "rich smart fx", condition: "если деп в крипте" },
  { name: "richsmartfx.com", condition: "если деп в крипте" },
  { name: "RoboForex", condition: "Что б был вывод на бинанс пэй" },
  { name: "sbivc.co.jp", condition: "апрув после списания" },
  { name: "secure.jdrsecurities.com", condition: "вывод только тем способом что и был деп" },
  { name: "skrill.com", condition: "доступен вывод в крипту" },
  { name: "startrader.com", condition: "ДЕП В КРИПТЕ + ТОТР ИНАЧЕ" },
  { name: "stockscommodity.com", condition: "dep crypto" },
  { name: "Tastytrade", condition: "включены крипто трансферы" },
  { name: "tentrade.com", condition: "выводит тем методом, что и деп" },
  { name: "thinkmarkets", condition: "withdrawal=crypto dep" },
  { name: "thinktrader", condition: "withdrawal=crypto dep" },
  { name: "tickmill.com", condition: "деп\\вывод в крипте" },
  { name: "topfx.com", condition: "с условием можно вывести то что депнул с крипты" },
  { name: "trade.bull-ex.com/", condition: "деп с крипты вывод от 3 дней" },
  { name: "tradonamarkets.com", condition: "Деп в крипте" },
  { name: "ultimamarkets.com", condition: "депы в крипте." },
  { name: "valetax", condition: "Вывод в том в чем завод" },
  { name: "valutrades.com", condition: "вывод онли на тот же путь с которого был деп!" },
  { name: "vtmarkets", condition: "крипто деп + смотреть на какую сумму можно сделать трансфер на крипто валет" },
  { name: "weltrade.com", condition: "условие деп в крипте/выводил фиат,иногда надо отписовку RAYAN 2/2" },
  { name: "wemastertrade", condition: "крипто деп 5 дней летит транза" },
  { name: "www.dbgmarketsglobal.com/", condition: "вывод только на банк, если депнул в крипте вывести сможешь только то что депнул или наторговал" },
  { name: "www.mygtcfx.com", condition: "Деп в крипте Раньше был точно нет" },
  { name: "XM.com", condition: "Степан сказал только деп с крипты" },
  { name: "youhodler", condition: "Вывод как деп" },
  { name: "Upbit.com", condition: "от 25к и Наличие других бирж" },
  { name: "landprime", condition: "крипто деп" },
  { name: "etoro", condition: "Колумбия, Новая Зеландия не депаются" },
  { name: "Ig.com", condition: "крипто вывод дотсупен только на UK" },
  { name: "Peska.co", condition: "Был хоть один вывод крипто" },
  { name: "tagmarkets", condition: "Доступен трансфер с трейдинг акка" },
  { name: "cxm.com", condition: "на выводе пишет, сколько доступно в крипту" },
  { name: "XS", condition: "крипто деп - иногда фиат слетает" },
  { name: "triv.co.id", condition: "можно пасс снести, слетает" },
  { name: "superfin", condition: "деп крипта, долго вылетает" },
  { name: "decodefx", condition: "крипто деп" },
  { name: "hapi.trade", condition: "" },
  { name: "Coinone", condition: "отсуствие какао толка, апрув после снятия" }
];

const exchangesNo = [
  "212 trading", "5paisa", "abtcoin.top", "AdmiralsGroup", "ADSS", "aff24.com", "angel one", "antstaking", "apextoken", "app.pluss500.com", "athene p2p", "aurumplatform.com", "auxiliarytrades", "AvaTrade", "axia", "axion trade", "axiontrade", "azasend.com", "b-bevolutionbank.com", "banexcapital.com", "bdtcoin", "beer789.com", "belo.app", "benchmark.com", "bestonfx.com", "billionbucksfx", "billionbucksfx.com", "binarex24.com", "bitmartsio.com", "bitpay.com", "bitsgloballimited.com", "Bitup.run", "Bitwallet", "blackarrow.com", "blackwellglobal.com", "blueberry", "britishglobaltrade.com", "btmarkets.com", "buddyex", "bullionx-inv.com", "bullmarketbrokers", "bursanet.actinver.com", "bxemm.top", "capex.com", "capitagains.com", "capitalfxweb", "CashApp", "Catamarkets.cc", "Century Finance", "cfifinancial.com", "cgfintech.com", "cgtrade.com", "cmcmarket.com", "Coin-trone.com", "coincodex.com", "coindcx.com", "CoinExmo", "Coinflux", "coingecko.com", "coinmarketcap.com/", "coinsanp.com", "coinstat \\ коинстат", "Coinstrat", "Coinswitch", "cointracker.io", "coinvale", "Coinwetalk.com", "commonapp.org", "commot.com.kh", "coolwallet", "cortexbroker.com", "cp.adsy.com", "cqg.com", "crynet.top", "cryptex.to", "crypto wheel", "Cryptomania.com", "ctrader", "danxdex.com", "Darwinex", "dbginternational.com", "deal.ig.com", "decocrypt.com", "Delta Exchange", "dexspas.com", "didimax.com", "digiu.ai", "dime.co.th", "Directfn.com", "directfundedtrading", "dupoin", "E-globaltrade", "earningcorp.net", "eightcap.com", "electriccapital.com", "ella.fund", "equiti.com", "equityedge.co.uk", "errante.com", "ETHxChaince", "eur.cashflow.fund", "exchange.revolut.com", "exnori.com", "expolitlimited.com", "f1xtm1.com", "fidelity.com", "fidelitygaintrade.com", "finotive markets", "finsaix", "fixalpha.info", "fizmofxmarkets", "fmcpay.com", "forex.com", "forex4you", "ftmo.com", "FundedNext", "fundedtradermarkets.com", "fundingtraders", "FX Replay", "fxcl.com (fxclearing.com)", "fxcm.com", "fxify.com", "fxopulence.com", "fxpig.com", "fxtrading.com", "fyers", "gambleons.com", "gateway.hana.network", "gbm", "gcash", "gcrypto", "ginfi.com", "globalbusinesspays", "globedse.com", "globedse.net", "goatfundedtrader.com", "gofx.com", "goldenstakes.org", "goldledgertrades.com", "Gomarkets", "gotrade", "grokrhot3.com", "groww", "h5.bxemm.top", "hantecmarkets.com", "hellostake.com", "hibt", "http://tdycoin.com/", "https://beta.traderscasa.com", "https://bitlet.net/", "https://bitnerex.com/", "https://bitstake.su/", "https://goldfun24k.com", "https://hub.the5ers.com/", "https://lwex.com/pc/", "https://my.acifx.com/", "https://my.mex.ae", "https://pixonul.com/", "https://portal.tradeville.ro/", "https://tradevisionproeg.com", "https://www.activtrades.com/", "https://www.futunn.com/en", "https://www.tmgm.com/en", "https://www.tradeeuglobal.net", "huntec markets", "hw.online", "ig.com", "inefex.com", "Inertix.pro", "INSTAFOREX", "Interactive Brokers", "interix", "invertironline", "Inveslo.com", "isevenbroker.com", "itiger.com", "iux.com/en", "JDR security", "jervix", "jetvix", "jgyfcrypto.co", "jsglobalonline.com", "Kbank.com", "kcmtrade.com", "keepbit", "KGI supenor option", "kingstonfinancialtrading.com", "la-token", "ledgerlock.io", "liberator.co.th", "litefxhub.com", "lococas.com", "ltcminer.com", "LTSMiner", "mas-markets.com", "matsui.co.jp", "MaxRichGroup", "MBS.com", "megawealth", "mercadopago", "mercato brokers", "MexGlobal", "mlx5wolf", "Monetag.com", "MonetaMarketsLive.com", "moneymitra.com", "moomoo.com", "MQl5", "mubashertrade", "mubashertrade.com", "munirkhanani.com", "murrenfx", "murrentrade", "Murrentrade.com", "my.fisg.com", "my.lightfx.jp", "mywealth.phillip.com.sg", "nagamena.com", "ncminvest", "nerdcryptomarket.com", "neteller.com", "new88bi.com", "ninjatrader", "noblefxmarket", "nodepay", "nordfx", "nubank.com", "oanda.com", "one-trader.com", "OneFor", "Onfa.io", "optimus (dash.optimus.vip)", "optimusfutures.com", "oracapital", "orchardchain.net", "PakistanMercantileExchangeLimited.com", "payforex.net", "PAYPAL.COM", "pboga.com", "PCEX", "platform.instantfunding.io", "platform.quick-funded.io", "platform.tradewealthvipclub", "pmex.com.pk", "preforex.com", "prexcard.com", "primemaxtrade", "pro.upstox", "profitpro.com", "PrymeCoin", "PurpleTrading", "qrsfx.com", "quantyx.io", "realix.cx", "realix.io", "rhbtradesmart.com", "richbirds.pro", "riottip.com", "riscoin.net", "ROBINHOOD", "sagemaster.io", "sahabat-invest.com", "samtradefx.com", "schwab.com", "Seafirst-miners", "secure.tptrades.com", "settrade.com", "shoonya.com", "silegxtu.com", "Smart Charts", "smartcharts.net", "stockbit", "stockbit.com", "stripe", "superai", "superai.com", "swissquote.com", "tcinvest.tcbs.com.vn", "tenadex.com", "thinkorswim.com", "ticmill", "tigerbrokers.com.sg", "tockenpocket.pro", "topstepx", "toptrader", "ToroTrader", "tptrades.com", "tra", "trade.ezsqtech.com", "trade.gooeytrade.com", "trade.paviliontrades.org", "tradehall.co", "TradeMax Global Limited", "tradex.live", "tradexprofit.com", "trading.pi.financial", "tradingpro.com", "tradingview.com", "TreasureNFT", "TriveInvest", "trustnap.net", "tv.dhan.co", "tvmarkets.com", "tw.islfx.com", "tycoonegypt.com", "UBITEX", "upperciruit.in", "vcgmarkets.com", "vebson", "Vestrado", "vndirect.com", "vodycoin.com", "Wacatrade.com", "warrenbowie", "wavedex.io", "wazxdex", "wealthwayinc.com", "web.samco.in", "Webull", "welonax.com/", "wilbal.com", "WingsFin", "wisdomfinancial", "wise", "wnstrade.com", "Worldcoin", "www.appgbm.com/", "www.mstock.com/", "www.unitedco.ps", "xbtrader.com", "XOH Trade", "xopenhub.pro", "xtb.com", "xtrend.com", "xwel.io", "ydrr.com", "yepbit.com", "yobit.net", "Zebpay", "zenstox", "Zerodha", "ZFC.com", "zgaxw.com", "zilnex.com", "zoldax.com", "Вasexwin.com", "tangem"
];

document.addEventListener("DOMContentLoaded", () => {
  const authScreen = document.getElementById("authScreen");
  const authTitle = document.getElementById("authTitle");
  const authSubtitle = document.getElementById("authSubtitle");
  const authUsername = document.getElementById("authUsername");
  const authPassword = document.getElementById("authPassword");
  const authSubmitBtn = document.getElementById("authSubmitBtn");
  const authErrorMsg = document.getElementById("authErrorMsg");
  const authSwitchMode = document.getElementById("authSwitchMode");
  
  let isRegisterMode = false;

  // ВСЕГДА показываем экран авторизации/регистрации при запуске приложения
  if (authScreen) {
    authScreen.style.display = "flex";
  }

  if (authSwitchMode) {
    authSwitchMode.addEventListener("click", (e) => {
      e.preventDefault();
      isRegisterMode = !isRegisterMode;
      if (isRegisterMode) {
        authTitle.innerText = "📝 Регистрация в Support Hub";
        authSubtitle.innerText = "Создайте новый аккаунт:";
        authSubmitBtn.innerText = "Зарегистрироваться";
        authSwitchMode.innerText = "Уже есть аккаунт? Войти";
      } else {
        authTitle.innerText = "👤 Вход в Support Hub";
        authSubtitle.innerText = "Введите данные для входа в систему:";
        authSubmitBtn.innerText = "Войти";
        authSwitchMode.innerText = "Нет аккаунта? Зарегистрироваться";
      }
      authErrorMsg.innerText = "";
    });
  }

  if (authSubmitBtn) {
    authSubmitBtn.addEventListener("click", async () => {
      const username = authUsername.value.trim();
      const password = authPassword.value.trim();

      if (!username || !password) {
        authErrorMsg.innerText = "Заполните все поля!";
        return;
      }

      const endpoint = isRegisterMode ? `${SERVER_API_URL}/api/register` : `${SERVER_API_URL}/api/login`;
      
      authErrorMsg.innerText = "Подключение к серверу (сервер может просыпаться до 30 секунд)...";
      authSubmitBtn.disabled = true;

      const makeAuthRequest = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            return data;
          } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      };

      try {
        const data = await makeAuthRequest(3);

        if (!data || !data.success) {
          authErrorMsg.innerText = data?.message || "Ошибка авторизации!";
          authSubmitBtn.disabled = false;
          return;
        }

        if (isRegisterMode) {
          alert("Регистрация успешна! Теперь войдите.");
          isRegisterMode = false;
          authTitle.innerText = "👤 Вход в Support Hub";
          authSubtitle.innerText = "Введите данные для входа в систему:";
          authSubmitBtn.innerText = "Войти";
          authSwitchMode.innerText = "Нет аккаунта? Зарегистрироваться";
          authPassword.value = "";
          authErrorMsg.innerText = "";
          authSubmitBtn.disabled = false;
          return;
        }

        localStorage.setItem('global_worker_nick', data.username);
        localStorage.setItem('support_hub_user', data.username);
        
        if (authScreen) authScreen.style.display = "none";
        authSubmitBtn.disabled = false;
        applyNickToApp(data.username);
        checkAdminAccess(data.username);
        initSocketConnection(data.username);

      } catch (err) {
        console.error("Ошибка связи с сервером авторизации:", err);
        authErrorMsg.innerText = "Не удалось подключиться к серверу! Попробуйте еще раз.";
        authSubmitBtn.disabled = false;
      }
    });
  }

  const tabButtons = document.querySelectorAll(".tab-btn, header button, .nav-btn");
  const tabContents = document.querySelectorAll(".content, .tab-content");

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const tabName = button.getAttribute("data-tab") || button.textContent.trim().toLowerCase();

      tabButtons.forEach(btn => btn.classList.remove("active"));
      tabContents.forEach(el => {
        el.classList.remove("active");
        el.style.display = "none";
      });

      button.classList.add("active");
      
      let targetTab = document.getElementById("tab-" + tabName) || document.getElementById(tabName);
      if (!targetTab) {
        tabContents.forEach(el => {
          if (el.id && el.id.toLowerCase().includes(tabName)) {
            targetTab = el;
          }
        });
      }

      if (targetTab) {
        targetTab.classList.add("active");
        targetTab.style.display = "block";
      }
    });
  });

  try {
    if (fs.existsSync(notesFilePath)) {
      const savedNotes = fs.readFileSync(notesFilePath, 'utf8');
      const userNotesEl = document.getElementById("userNotes");
      if (userNotesEl) userNotesEl.value = savedNotes;
    }
  } catch (err) {
    console.error("Ошибка чтения файла заметок:", err);
  }

  loadShiftState();
  initChatUI();
  renderExchangeLists();

  const globalNickEl = document.getElementById("globalWorkerNick");
  if (globalNickEl) {
    globalNickEl.addEventListener("input", saveGlobalNick);
    globalNickEl.addEventListener("change", saveGlobalNick);
  }

  const shiftNickEl = document.getElementById("userNick");
  if (shiftNickEl) {
    shiftNickEl.addEventListener("input", () => {
      const val = shiftNickEl.value.trim();
      if (val) {
        localStorage.setItem('global_worker_nick', val);
        localStorage.setItem('support_hub_user', val);
        if (globalNickEl && globalNickEl.value !== val) globalNickEl.value = val;
      }
    });
  }

  const templateBtn = document.getElementById("templateBtn");
  if (templateBtn) templateBtn.addEventListener("click", insertTruffleTemplate);
  
  const sendBugBtn = document.getElementById("sendBugBtn");
  if (sendBugBtn) sendBugBtn.addEventListener("click", sendBugReport);
  
  const checkTrufflesBtn = document.getElementById("checkTrufflesBtn");
  if (checkTrufflesBtn) {
    checkTrufflesBtn.addEventListener("click", checkTruffles);
  }

  const startBtn = document.getElementById("startBtn");
  if (startBtn) startBtn.addEventListener("click", toggleShift);
  
  const stopBtn = document.getElementById("stopBtn");
  if (stopBtn) stopBtn.addEventListener("click", finishShift);
  
  const addOneBtn = document.getElementById("addOneBtn");
  if (addOneBtn) addOneBtn.addEventListener("click", () => addCount(1));
  
  const addFiveBtn = document.getElementById("addFiveBtn");
  if (addFiveBtn) addFiveBtn.addEventListener("click", () => addCount(5));
  
  const subOneBtn = document.getElementById("subOneBtn");
  if (subOneBtn) subOneBtn.addEventListener("click", () => addCount(-1));
  
  const resetShiftBtn = document.getElementById("resetShiftBtn");
  if (resetShiftBtn) resetShiftBtn.addEventListener("click", resetShift);
  
  const copyBtn = document.getElementById("copyBtn");
  if (copyBtn) copyBtn.addEventListener("click", copyReport);
  
  const sendOvertimeBtn = document.getElementById("sendOvertimeBtn");
  if (sendOvertimeBtn) sendOvertimeBtn.addEventListener("click", sendOvertime);
  
  const sendCallBtn = document.getElementById("sendCallBtn");
  if (sendCallBtn) sendCallBtn.addEventListener("click", sendCallEntry);
  
  const sendLeaveBtn = document.getElementById("sendLeaveBtn");
  if (sendLeaveBtn) sendLeaveBtn.addEventListener("click", sendLeave);
  
  const openExplorerBtn = document.getElementById("openExplorerBtn");
  if (openExplorerBtn) openExplorerBtn.addEventListener("click", openExplorer);
  
  const saveNotesBtn = document.getElementById("saveNotesBtn");
  if (saveNotesBtn) saveNotesBtn.addEventListener("click", saveNotes);

  const exchangeSearchInput = document.getElementById("exchangeSearchInput");
  if (exchangeSearchInput) {
    exchangeSearchInput.addEventListener("input", handleExchangeSearch);
  }

  const adminTriggerBtn = document.getElementById("adminTriggerBtn");
  if (adminTriggerBtn) {
    adminTriggerBtn.addEventListener("click", () => {
      if (socket) {
        socket.emit('admin_trigger', { text: "РАБОТАЙ СУКА" });
        alert("Триггер 'РАБОТАЙ СУКА' отправлен всем в чат!");
      } else {
        alert("Нет соединения с сервером чата.");
      }
    });
  }

  setupAdminModerationActions();
  setInterval(initRealtimeStatus, 15000);
});

function initSocketConnection(username) {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SERVER_API_URL);

  socket.on('connect', () => {
    console.log("Успешное подключение к Socket.io серверу");
    socket.emit('join_chat', username);
  });

  socket.on('chat_message', (msgData) => {
    appendMessageToChatUI(msgData);
  });

  socket.on('admin_trigger', (data) => {
    alert(`⚡ СИГНАЛ АДМИНА: ${data.text}`);
    if (window.electron && window.electron.showNotification) {
      window.electron.showNotification("Внимание от администратора", data.text);
    }
  });

  socket.on('user_muted', (data) => {
    if (data.username.toLowerCase() === username.toLowerCase()) {
      alert("⚠️ Администратор выдал вам мут в чате!");
    }
  });

  socket.on('user_banned', (data) => {
    if (data.username.toLowerCase() === username.toLowerCase()) {
      alert("❌ Ваш аккаунт заблокирован администратором.");
      localStorage.clear();
      location.reload();
    }
  });
}

function initChatUI() {
  const chatInput = document.getElementById("chatInput") || document.querySelector(".chat-input input") || document.querySelector("input[placeholder*='сообщение']");
  const chatSendBtn = document.getElementById("chatSendBtn") || document.querySelector(".chat-input button") || document.querySelector("button.chat-send");

  if (!chatInput) return;

  const sendMessage = () => {
    const text = chatInput.value.trim();
    if (!text) return;
    const currentNick = localStorage.getItem('global_worker_nick') || localStorage.getItem('support_hub_user') || "Аноним";

    if (socket && socket.connected) {
      socket.emit('chat_message', { username: currentNick, text: text });
      chatInput.value = "";
    } else {
      alert("Нет соединения с сервером чата!");
    }
  };

  if (chatSendBtn) {
    chatSendBtn.onclick = (e) => {
      e.preventDefault();
      sendMessage();
    };
  }

  chatInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };
}

function appendMessageToChatUI(msgData) {
  const chatMessagesContainer = document.getElementById("chatMessages") || document.querySelector(".chat-messages") || document.querySelector(".chat-history");
  if (!chatMessagesContainer) return;

  const messageDiv = document.createElement("div");
  messageDiv.className = "chat-msg-item";
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  messageDiv.innerHTML = `<span class="msg-time">[${timeStr}]</span> <strong>${escapeHtml(msgData.username)}:</strong> ${escapeHtml(msgData.text)}`;
  chatMessagesContainer.appendChild(messageDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function setupAdminModerationActions() {
  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("mute-btn") || e.target.closest(".mute-btn")) {
      const btn = e.target.closest(".mute-btn") || e.target;
      const targetUser = btn.getAttribute("data-user");
      if (!targetUser) return;

      try {
        const res = await fetch(`${SERVER_API_URL}/api/moderate/mute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: targetUser, isMuted: true })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Пользователь ${targetUser} замучен.`);
          if (socket) socket.emit('mute_user', { username: targetUser });
        } else {
          alert(data.message || "Ошибка при отправке запроса мута");
        }
      } catch (err) {
        console.error(err);
        alert("Ошибка сети при отправке запроса мута");
      }
    }

    if (e.target.classList.contains("ban-btn") || e.target.closest(".ban-btn")) {
      const btn = e.target.closest(".ban-btn") || e.target;
      const targetUser = btn.getAttribute("data-user");
      if (!targetUser) return;

      try {
        const res = await fetch(`${SERVER_API_URL}/api/moderate/ban`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: targetUser, isBanned: true })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Пользователь ${targetUser} забанен.`);
          if (socket) socket.emit('ban_user', { username: targetUser });
        } else {
          alert(data.message || "Ошибка при бане пользователя");
        }
      } catch (err) {
        console.error(err);
        alert("Ошибка сети при бане");
      }
    }

    if (e.target.classList.contains("work-trigger-btn") || e.target.closest(".work-trigger-btn")) {
      const btn = e.target.closest(".work-trigger-btn") || e.target;
      const targetUser = btn.getAttribute("data-user");
      if (!targetUser) return;

      if (socket) {
        socket.emit('admin_trigger_user', { username: targetUser, text: "РАБОТАЙ СУКА" });
        alert(`Сигнал 'РАБОТАЙ СУКА' отправлен пользователю: ${targetUser}`);
      }
    }
  });
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function checkAdminAccess(nick) {
  const adminTabBtn = document.getElementById("adminTabBtn");
  if (nick && nick.toLowerCase() === "fifflaren") {
    if (adminTabBtn) adminTabBtn.style.display = "inline-block";
  } else {
    if (adminTabBtn) adminTabBtn.style.display = "none";
  }
}

function applyNickToApp(currentNick) {
  const globalNickInput = document.getElementById("globalWorkerNick");
  if (globalNickInput) globalNickInput.value = currentNick;

  const shiftNick = document.getElementById("userNick");
  if (shiftNick && !shiftNick.disabled) shiftNick.value = currentNick;

  updateOnlineStatus(currentNick);
  checkAdminAccess(currentNick);
  setTimeout(initRealtimeStatus, 500);
}

function updateOnlineStatus(currentNick) {
  const items = document.querySelectorAll('.team-list li');
  items.forEach(item => {
    const nickName = item.getAttribute('data-nick');
    if (nickName && currentNick && nickName.toLowerCase() === currentNick.toLowerCase()) {
      item.classList.add('online');
    }
  });
}

function initRealtimeStatus() {
  const currentNick = localStorage.getItem('global_worker_nick') || localStorage.getItem('support_hub_user');
  if (!currentNick) return;

  fetch(WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "heartbeat", nick: currentNick })
  }).catch(err => console.error("Ошибка отправки heartbeat:", err));

  fetch(WEB_APP_URL)
    .then(res => res.json())
    .then(onlineNicks => {
      updateOnlineUI(onlineNicks);
    })
    .catch(err => console.error("Ошибка получения онлайн-статусов:", err));
}

function updateOnlineUI(onlineNicks) {
  if (!Array.isArray(onlineNicks)) return;
  const items = document.querySelectorAll('.team-list li');
  items.forEach(item => {
    const nickName = item.getAttribute('data-nick');
    if (!nickName) return;

    const isOnline = onlineNicks.some(n => n.toLowerCase() === nickName.toLowerCase());
    if (isOnline) {
      item.classList.add('online');
    } else {
      item.classList.remove('online');
    }
  });
}

function saveGlobalNick() {
  const globalNickInput = document.getElementById("globalWorkerNick");
  if (!globalNickInput) return;
  const nick = globalNickInput.value.trim();
  
  localStorage.setItem('global_worker_nick', nick);
  localStorage.setItem('support_hub_user', nick);
}

function renderExchangeLists() {}
function handleExchangeSearch(e) {}
function loadShiftState() {}
function toggleShift() {}
function finishShift() {}
function addCount(val) {}
function resetShift() {}
function copyReport() {}
function sendOvertime() {}
function sendCallEntry() {}
function sendLeave() {}
function openExplorer() {}
function saveNotes() {}
function insertTruffleTemplate() {}
function sendBugReport() {}
function checkTruffles() {}