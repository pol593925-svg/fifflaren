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
  "1xBet", "3commas", "aarman.com", "account.bcx.ba", "ACY.COM", "altex.mn", "app.airtm.com", "app.btcmarkets.net", "app.simplefx.com", "arbitrageth", "ascendex.com", "astekbet.com", "ATX", "axieinfinity.com", "axiom.trade", "bc.game", "betfury.com", "betterx.io", "bikingex.com", "binance.com", "binance.info", "binance.me", "binance.th", "binance.tr", "bingx.com", "bitazza.com", "bitbank.cc", "bitcasino.io", "bitfinex.com", "bitget.com", "bitgo.com", "bitmart.com", "bitmex.com", "bitnet.ge", "bitopro", "bitpanda.com", "bitpoint", "bitqik.com", "bitrue", "bitso.com", "bitstamp.com", "bitstreetx", "bittradex", "bittworld.com", "bitunix.com", "blockchain.com", "blocktrade.com", "blofin.com", "blofin.com", "btcc.com", "buda.com", "buenbit.com/", "bull-ex.com", "bybit.com", "bydfi.com", "bytick.com", "ceres-finance.com", "cex.io", "client.bitharvest.io", "coin.z.com", "coinbase.com", "coincheck", "coindepo.com", "coinex.com", "Coinext", "coinhako", "coinhub.mn", "Coinone", "coins.ph", "coinshub.mn", "coinspot.com", "coinstash.com.au", "coinstore.com", "cointree.com", "coinw.com", "Covest.pro", "crypsity.com", "cryptal.com", "crypto.com", "csgoempire.com", "cwallet.com", "decrypto.la", "Deribit", "digifinex", "digitalsurge.com.au", "easicoin", "efsanetr.com", "ether.fi", "exchange.fastex.com", "f2pool.com", "fcxtrade.com", "fiahub.com", "finandy.com", "fiwind.io", "fiwind.io", "fiybit.com", "flipster.io", "fortunomarkets.com", "fpmarkets.com", "fusionmarkets.com", "gamdom", "gate.io", "gemini.com", "globalprime.com", "hapiapp.com", "hashkey.com", "hata.io", "hotbit.com", "htfx.com", "https://attlas.io/", "https://bitflyer.com", "https://dzhlwk.com", "https://grvt.io/exchange/strategies", "https://hexn.io", "https://kms.kinesis.money/", "https://mycoins.ge/", "https://portal.blueberrymarkets.com", "https://safetrade.com/", "https://swyftx.com/", "https://weex.exchange", "https://www.alchemy.com/", "https://www.btse.com/", "https://www.independentreserve.com/", "https://www.mountainwolf.com", "https://www.zoomex.com/", "https://xpo.ru", "htx.com", "idax.com", "ijex.net/pc/#/home", "indodax.com", "KAST.com", "kraken.com", "kryptex.com", "kucoin.com", "latoken", "lazzaglobal.com", "lbank.com", "lobstr.co", "luno.com", "max.maicoin.com", "maxifyfx.com", "mercadobitcoin", "mercadobitcoin.com.br", "meru.com", "mexc.com", "mobee.io", "MOTFX", "multibankfx.com", "mystake", "nexo.com", "NiceHash", "noones.com", "novadax.com", "okx.com", "One royal", "opensea.io", "optgobroker.com", "orangex.com", "orbixtrade.com", "osl.com", "p2pb2b.com", "paribu", "paxfull", "pdax.ph", "phemex.com", "picnic.com", "Pinetwork", "pintu.co.id", "pionex.com", "pluang.com", "polaris-io.com", "poloniex.com", "polymarket", "portal.fxgt.com/", "Primefort", "primexbt.com", "probit.com", "quickswap.exchange", "redotpay", "reku.id", "remitano.com", "salepoint.io", "solcasino.io", "solflare", "strifor.biz", "sun.win", "tapbit.com", "tokenizemalaysia.com", "TokoCrypto", "toobit.com", "trade.50x.com", "tradequo.com", "TradeSilvania", "trading.bridgemarkets.global", "trading.quantfury.com", "ttx.vip", "Valr.com", "viabtc.com", "wazirx.com", "websea.com", "webtrader.kimonsage.co", "wefi.co", "whitebit.com", "whiteforex.com", "WOOX", "www.altcointrader.co.za/", "www.hotcoin.com/", "x-meta.com", "xchengeon.io", "XT.com", "yeet.com", "youholder.com", "yubit", "zaifjp.com", "eormc.id"
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

  const savedNick = localStorage.getItem('global_worker_nick') || localStorage.getItem('support_hub_user') || "";

  if (!savedNick) {
    if (authScreen) authScreen.style.display = "flex";
  } else {
    if (authScreen) authScreen.style.display = "none";
    applyNickToApp(savedNick);
    checkAdminAccess(savedNick);
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

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!data.success) {
          authErrorMsg.innerText = data.message || "Ошибка авторизации!";
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
          return;
        }

        localStorage.setItem('global_worker_nick', data.username);
        localStorage.setItem('support_hub_user', data.username);
        
        if (authScreen) authScreen.style.display = "none";
        applyNickToApp(data.username);
        checkAdminAccess(data.username);

        if (socket) {
          socket.emit('join_chat', data.username);
        }
      } catch (err) {
        console.error("Ошибка связи с сервером авторизации:", err);
        authErrorMsg.innerText = "Не удалось подключиться к серверу!";
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
  initChat();
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

  setTimeout(initRealtimeStatus, 1000);
  setInterval(initRealtimeStatus, 15000);
});

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
  
  const shiftNick = document.getElementById("userNick");
  if (shiftNick && !shiftNick.disabled) {
    shiftNick.value = nick;
  }
  
  updateOnlineStatus(nick);
  checkAdminAccess(nick);
  initRealtimeStatus();
  if (socket) {
    socket.emit('join_chat', nick);
  }
}

function sendDataToSheet(payload) {
  fetch(WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(err => console.error("Ошибка отправки в таблицу:", err));
}

function checkTruffles() {
  const nick = document.getElementById("globalWorkerNick")?.value.trim() || localStorage.getItem('global_worker_nick') || localStorage.getItem('support_hub_user') || "";
  const resultBox = document.getElementById("trufflesResultBox");

  if (!nick) {
    alert("Укажите ваш никнейм в поле выше!");
    return;
  }

  if (resultBox) {
    resultBox.style.display = "block";
    resultBox.innerHTML = "⏳ Загрузка статистики...";
  }

  fetch(`${WEB_APP_URL}?action=getTruffles&nick=${encodeURIComponent(nick)}`)
    .then(res => res.json())
    .then(data => {
      if (resultBox) {
        if (data && data.success) {
          resultBox.innerHTML = `✅ <b>Статистика для ${nick}:</b><br>💎 Трюфелей найдено: <b>${data.count || 0}</b>`;
        } else {
          resultBox.innerHTML = `ℹ️ ${data.message || "Данные не найдены или ошибка сервера."}`;
        }
      }
    })
    .catch(err => {
      console.error("Ошибка получения статистики (GET):", err);
      fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "getTruffles", nick: nick })
      })
      .then(res => res.json())
      .then(data => {
        if (resultBox) {
          resultBox.innerHTML = `✅ Данные запрошены. Результат: ${JSON.stringify(data)}`;
        }
      })
      .catch(e => {
        if (resultBox) {
          resultBox.innerHTML = `❌ Не удалось получить данные. Проверьте соединение.`;
        }
      });
    });
}

function saveNotes() {
  const notes = document.getElementById("userNotes").value;
  try {
    fs.writeFileSync(notesFilePath, notes, 'utf8');
    const status = document.getElementById("notesStatus");
    if (status) {
      status.innerText = "Сохранено в файл!";
      setTimeout(() => status.innerText = "", 2000);
    }
  } catch (err) {
    alert("Ошибка сохранения: " + err.message);
  }
}

function insertTruffleTemplate() {
  const desc = document.getElementById("bugDesc");
  if (!desc) return;
  desc.value = "Search- \nID- \nSumma- \nКомментарий по логу- ";
}

function sendBugReport() {
  const nick = document.getElementById("globalWorkerNick")?.value.trim() || localStorage.getItem('global_worker_nick') || localStorage.getItem('support_hub_user') || "Аноним";
  const type = document.getElementById("bugType").value;
  const desc = document.getElementById("bugDesc").value.trim();
  if (!desc) { alert("Заполните описание!"); return; }

  sendDataToSheet({
    type: "Логи ошибок",
    nick: nick,
    bugType: type,
    desc: desc
  });

  document.getElementById("bugDesc").value = "";
  const msg = document.getElementById("statusMsg");
  if (msg) {
    msg.innerText = "Отчет отправлен в таблицу!";
    setTimeout(() => msg.innerText = "", 3000);
  }
}

function calculateDuration(from, to) {
  const startParts = from.split(':');
  const endParts = to.split(':');
  const startDate = new Date(0, 0, 0, startParts[0], startParts[1]);
  const endDate = new Date(0, 0, 0, endParts[0], endParts[1]);
  
  let diff = endDate - startDate;
  if (diff < 0) diff += 24 * 60 * 60 * 1000;
  
  const hours = Math.floor(diff / 1000 / 60 / 60);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  return `${hours} ч. ${minutes > 0 ? minutes + ' мин.' : ''}`.trim();
}

function sendOvertime() {
  const nick = document.getElementById("globalWorkerNick")?.value.trim() || document.getElementById("userNick")?.value.trim() || localStorage.getItem('global_worker_nick') || "Сотрудник";
  const fromTime = document.getElementById("overtimeFrom").value;
  const toTime = document.getElementById("overtimeTo").value;
  
  if (!fromTime || !toTime) { alert("Укажите время 'От' и 'До'!"); return; }
  
  const totalDuration = calculateDuration(fromTime, toTime);
  
  sendDataToSheet({
    type: "Овертаймы",
    nick: nick,
    fromTime: fromTime,
    toTime: toTime,
    totalDuration: totalDuration
  });
  
  document.getElementById("overtimeFrom").value = "";
  document.getElementById("overtimeTo").value = "";
  
  const status = document.getElementById("overtimeStatus");
  if (status) {
    status.innerText = "✅ Овертайм добавлен!";
    setTimeout(() => status.innerText = "", 3000);
  }
}

function sendCallEntry() {
  const nick = document.getElementById("globalWorkerNick")?.value.trim() || document.getElementById("userNick")?.value.trim() || localStorage.getItem('global_worker_nick') || "Сотрудник";
  const callType = document.getElementById("callTypeSelect").value;
  const serviceName = document.getElementById("callServiceName").value.trim();
  const callLink = document.getElementById("callLinkInput").value.trim();
  const callNote = document.getElementById("callNoteInput").value.trim();
  
  if (!serviceName || !callLink) { alert("Заполните название и ссылку!"); return; }
  
  sendDataToSheet({
    type: "Колы",
    nick: nick,
    callType: callType,
    serviceName: serviceName,
    callLink: callLink,
    callNote: callNote
  });
  
  document.getElementById("callServiceName").value = "";
  document.getElementById("callLinkInput").value = "";
  document.getElementById("callNoteInput").value = "";
  
  const status = document.getElementById("callStatus");
  if (status) {
    status.innerText = "✅ Колл отправлен в таблицу!";
    setTimeout(() => status.innerText = "", 3000);
  }
}

function sendLeave() {
  const nick = document.getElementById("globalWorkerNick")?.value.trim() || localStorage.getItem('global_worker_nick') || "Аноним";
  const reason = document.getElementById("leaveReason").value;
  const comment = document.getElementById("leaveComment").value.trim();
  const date = document.getElementById("leaveDate").value;
  const from = document.getElementById("leaveTimeFrom").value;
  const to = document.getElementById("leaveTimeTo").value;

  if (!date || !from || !to) { alert("Заполните дату и время!"); return; }

  const fullReason = comment ? `${reason} — ${comment}` : reason;

  sendDataToSheet({
    type: "Отпроситься",
    nick: nick,
    reason: fullReason,
    leaveDate: date,
    from: from,
    to: to
  });

  const status = document.getElementById("leaveStatus");
  if (status) {
    status.innerText = "Запрос отправлен в таблицу!";
    setTimeout(() => status.innerText = "", 3000);
  }
}

function openExplorer() {
  const net = document.getElementById("network").value;
  const raw = document.getElementById("cryptoQuery").value.trim();
  if (!raw) { alert("Введите хэш или адрес!"); return; }
  const clean = raw.split("/").pop().split("?")[0].trim();
  let url = "";

  if (net === "arkham") url = "https://platform.arkhamintelligence.com/explorer/address/" + clean;
  else if (net === "pi") url = "https://blockexplorer.minepi.com/mainnet/search?q=" + encodeURIComponent(clean);
  else if (net === "bsc") url = "https://bscscan.com/search?q=" + encodeURIComponent(clean);
  else if (net === "tron") url = "https://tronscan.org/#/search/" + encodeURIComponent(clean);
  else if (net === "eth") url = "https://etherscan.io/search?q=" + encodeURIComponent(clean);
  else if (net === "btc") url = "https://blockchair.com/search?q=" + encodeURIComponent(clean);
  else if (net === "sol") url = "https://solscan.io/account/" + encodeURIComponent(clean);

  window.open(url, "_blank");
}

function toggleShift() {
  const nickEl = document.getElementById("userNick");
  const globalNickEl = document.getElementById("globalWorkerNick");
  
  const nick = (nickEl && nickEl.value.trim()) || (globalNickEl && globalNickEl.value.trim()) || localStorage.getItem('global_worker_nick') || "";
  
  if (!nick) { 
    alert("Укажите никнейм!"); 
    if (globalNickEl) globalNickEl.focus();
    return; 
  }

  localStorage.setItem('global_worker_nick', nick);
  localStorage.setItem('support_hub_user', nick);
  if (globalNickEl) globalNickEl.value = nick;
  if (nickEl) nickEl.value = nick;

  if (!isWorking) {
    isWorking = true;
    startTimeMs = new Date().getTime();
    startTimeStr = new Date().toLocaleTimeString();
    count = 0;

    document.getElementById("startBtn").style.display = "none";
    document.getElementById("stopBtn").style.display = "block";
    if (nickEl) nickEl.disabled = true;
    document.getElementById("counterBox").style.opacity = "1";
    document.getElementById("counterBox").style.pointerEvents = "auto";
    
    startTimerLoop();
    saveShiftState();
  }
}

function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((new Date().getTime() - startTimeMs) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    const timerDisplay = document.getElementById("timerDisplay");
    if (timerDisplay) timerDisplay.innerText = `${h}:${m}:${s}`;
  }, 1000);
}

function addCount(val) {
  if (!isWorking) return;
  count += val;
  if (count < 0) count = 0;
  document.getElementById("countDisplay").innerText = count;

  const nick = document.getElementById("userNick")?.value.trim() || localStorage.getItem('global_worker_nick');
  const logInput = document.getElementById("logLinkInput").value.trim();
  const logComment = document.getElementById("logCommentInput").value.trim();

  if (val > 0 && logInput !== "") {
    sendDataToSheet({
      type: "Отчет логов",
      nick: nick,
      logInput: logInput,
      logComment: logComment,
      count: count
    });
    document.getElementById("logLinkInput").value = "";
    document.getElementById("logCommentInput").value = "";
  }
  saveShiftState();
}

function finishShift() {
  if (!isWorking) return;
  clearInterval(timerInterval);
  isWorking = false;

  const nick = document.getElementById("userNick")?.value.trim() || localStorage.getItem('global_worker_nick');
  const timeStr = document.getElementById("timerDisplay").innerText;
  const endTimeStr = new Date().toLocaleTimeString();
  
  const report = `🏁 ОТЧЁТ ЗА СМЕНУ\n👤 Работник: ${nick}\n⏰ Время: ${timeStr} (${startTimeStr} - ${endTimeStr})\n📊 Логов: ${count}`;

  sendDataToSheet({
    type: "Отчёты смен",
    nick: nick,
    start: startTimeStr,
    end: endTimeStr,
    duration: timeStr,
    count: count
  });

  document.getElementById("reportBox").innerText = report;
  document.getElementById("reportBox").style.display = "block";
  document.getElementById("copyBtn").style.display = "block";
  document.getElementById("stopBtn").style.display = "none";

  localStorage.removeItem('shift_state');
}

function resetShift() {
  if (confirm("Сбросить таймер и начать новую смену?")) {
    clearInterval(timerInterval);
    isWorking = false;
    count = 0;
    document.getElementById("timerDisplay").innerText = "00:00:00";
    document.getElementById("countDisplay").innerText = "0";
    
    const nickEl = document.getElementById("userNick");
    if (nickEl) nickEl.disabled = false;
    
    document.getElementById("startBtn").style.display = "block";
    document.getElementById("stopBtn").style.display = "none";
    document.getElementById("counterBox").style.opacity = "0.5";
    document.getElementById("counterBox").style.pointerEvents = "none";
    document.getElementById("reportBox").style.display = "none";
    document.getElementById("copyBtn").style.display = "none";
    localStorage.removeItem('shift_state');
  }
}

function copyReport() {
  const text = document.getElementById("reportBox").innerText;
  navigator.clipboard.writeText(text).then(() => alert("Отчёт скопирован!"));
}

function saveShiftState() {
  const nickEl = document.getElementById("userNick");
  const state = { isWorking, startTimeMs, startTimeStr, count, nick: nickEl ? nickEl.value : '' };
  localStorage.setItem('shift_state', JSON.stringify(state));
}

function loadShiftState() {
  const savedState = localStorage.getItem('shift_state');
  if (savedState) {
    const res = JSON.parse(savedState);
    if (res && res.isWorking) {
      isWorking = true;
      startTimeMs = res.startTimeMs;
      startTimeStr = res.startTimeStr || "00:00:00";
      count = res.count;
      
      const nickEl = document.getElementById("userNick");
      if (nickEl) {
        nickEl.value = res.nick;
        nickEl.disabled = true;
      }
      
      document.getElementById("startBtn").style.display = "none";
      document.getElementById("stopBtn").style.display = "block";
      document.getElementById("counterBox").style.opacity = "1";
      document.getElementById("counterBox").style.pointerEvents = "auto";
      document.getElementById("countDisplay").innerText = count;
      startTimerLoop();
    }
  }
}

function initChat() {
  socket = io(SERVER_API_URL, {
    transports: ['websocket']
  });

  socket.on('connect', () => {
    console.log("🟢 Успешное подключение к серверу чата!");
    const nick = document.getElementById("globalWorkerNick")?.value.trim() || localStorage.getItem('global_worker_nick') || "Аноним";
    socket.emit('join_chat', nick);
  });

  socket.on('chat_message', (data) => {
    appendMessageToChat(data.nick, data.text, data.time);
  });

  socket.on('chat_error', (data) => {
    alert(data.message);
  });

  socket.on('update_chat_users', (usersArray) => {
    updateChatOnlineUI(usersArray);
  });

  socket.on('admin_trigger', (data) => {
    showRabotaySukaModal(data.text || "РАБОТАЙ СУКА");
  });

  const sendBtn = document.getElementById("sendChatMessageBtn");
  const inputEl = document.getElementById("chatInput");

  if (sendBtn && inputEl) {
    sendBtn.addEventListener("click", sendChatMessage);
    inputEl.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendChatMessage();
    });
  }
}

function showRabotaySukaModal(text) {
  let modal = document.getElementById("rabotaySukaModalOverlay");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "rabotaySukaModalOverlay";
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(220, 53, 69, 0.85);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background: #111; padding: 40px 60px; border-radius: 16px; border: 4px solid #fff; text-align: center; box-shadow: 0 0 50px rgba(0,0,0,0.8);">
      <h1 style="color: #ff3333; font-size: 48px; margin: 0 0 20px 0; font-weight: 900; letter-spacing: 2px;">⚠️ УВЕДОМЛЕНИЕ ⚠️</h1>
      <p style="color: #fff; font-size: 32px; font-weight: bold; margin: 0 0 30px 0; text-transform: uppercase;">${text}</p>
      <button id="closeSukaModalBtn" style="background: #28a745; color: #fff; border: none; padding: 12px 30px; font-size: 18px; font-weight: bold; border-radius: 8px; cursor: pointer;">ПОНЯЛ, РАБОТАЮ</button>
    </div>
  `;
  modal.style.display = "flex";

  try {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => {});
  } catch(e) {}

  document.getElementById("closeSukaModalBtn").addEventListener("click", () => {
    modal.style.display = "none";
  });
}

function sendChatMessage() {
  const inputEl = document.getElementById("chatInput");
  const text = inputEl.value.trim();
  if (!text) return;

  const nick = document.getElementById("globalWorkerNick")?.value.trim() || localStorage.getItem('global_worker_nick') || "Аноним";
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  socket.emit('chat_message', { username: nick, nick, text, time });
  inputEl.value = "";
}

function appendMessageToChat(nick, text, time) {
  const chatContainer = document.getElementById("chatMessages");
  if (!chatContainer) return;

  const currentNick = localStorage.getItem('global_worker_nick') || "";
  const isMyMessage = nick.toLowerCase() === currentNick.toLowerCase();

  const messageDiv = document.createElement("div");
  messageDiv.style.cssText = `
    max-width: 75%;
    padding: 10px 14px;
    border-radius: 8px;
    background: ${isMyMessage ? '#2b5278' : '#2a2a3d'};
    align-self: ${isMyMessage ? 'flex-end' : 'flex-start'};
    color: #fff;
    font-size: 14px;
    word-break: break-word;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;

  messageDiv.innerHTML = `
    <div style="font-size: 11px; color: ${isMyMessage ? '#8ec5fc' : '#aaa'}; margin-bottom: 3px; font-weight: bold;">${nick}</div>
    <div>${text}</div>
    <div style="font-size: 10px; color: #888; text-align: right; margin-top: 4px;">${time}</div>
  `;

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function updateChatOnlineUI(usersArray) {
  const listEl = document.getElementById("chatOnlineList");
  if (!listEl) return;

  listEl.innerHTML = "";
  usersArray.forEach(nick => {
    const li = document.createElement("li");
    li.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: #1e1e2f; border-radius: 6px; margin-bottom: 4px;";
    li.innerHTML = `
      <span style="display: flex; align-items: center; gap: 8px;">
        <span style="width: 8px; height: 8px; background: #28a745; border-radius: 50%; box-shadow: 0 0 6px #28a745; display: inline-block;"></span>
        ${nick}
      </span>
    `;
    listEl.appendChild(li);
  });

  const adminUsersList = document.getElementById("adminUsersList");
  if (adminUsersList) {
    adminUsersList.innerHTML = "";
    if (usersArray.length === 0) {
      adminUsersList.innerHTML = "<div style='color: #888;'>Нет пользователей онлайн</div>";
    } else {
      usersArray.forEach(nick => {
        const row = document.createElement("div");
        row.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #1a1a24; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid #28a745;";
        
        row.innerHTML = `
          <span style="color: #fff; font-weight: 500;">👤 ${nick}</span>
          <div style="display: flex; gap: 5px;">
            <button class="mute-user-btn" data-target-nick="${nick}" style="background: #ffc107; color: #000; border: none; padding: 5px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">🔇 Мут</button>
            <button class="ban-user-btn" data-target-nick="${nick}" style="background: #dc3545; color: #fff; border: none; padding: 5px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">🔨 Бан</button>
            <button class="target-suka-btn" data-target-nick="${nick}" style="background: #17a2b8; color: #fff; border: none; padding: 5px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">🎯 РАБОТАЙ</button>
          </div>
        `;
        adminUsersList.appendChild(row);
      });

      document.querySelectorAll(".mute-user-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const targetNick = e.target.getAttribute("data-target-nick");
          try {
            const res = await fetch(`${SERVER_API_URL}/api/moderate/mute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: targetNick, isMuted: true })
            });
            const data = await res.json();
            if (data.success) alert(`Пользователь ${targetNick} замучен!`);
          } catch (err) {
            alert("Ошибка при отправке запроса мута");
          }
        });
      });

      document.querySelectorAll(".ban-user-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const targetNick = e.target.getAttribute("data-target-nick");
          if (!confirm(`Вы уверены, что хотите забанить ${targetNick}?`)) return;
          try {
            const res = await fetch(`${SERVER_API_URL}/api/moderate/ban`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: targetNick, isBanned: true })
            });
            const data = await res.json();
            if (data.success) alert(`Пользователь ${targetNick} заблокирован!`);
          } catch (err) {
            alert("Ошибка при отправке запроса бана");
          }
        });
      });

      document.querySelectorAll(".target-suka-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const targetNick = e.target.getAttribute("data-target-nick");
          if (socket) {
            socket.emit('admin_target_trigger', { targetNick: targetNick, text: "РАБОТАЙ СУКА" });
            alert(`Сигнал 'РАБОТАЙ СУКА' отправлен пользователю: ${targetNick}`);
          }
        });
      });
    }
  }
}

// --- НАДЕЖНЫЙ ПОИСК ИЗОЛИРОВАННЫХ КОЛОНОК ---
function getContainerByTitle(titleKeyword) {
  const allElements = document.querySelectorAll("div, span, h1, h2, h3, h4, p");
  let targetEl = null;
  
  for (const el of allElements) {
    if (el.textContent && el.textContent.trim().includes(titleKeyword)) {
      const text = el.textContent;
      if (titleKeyword === "Точно да" && text.includes("Точно нет")) continue;
      if (titleKeyword === "С условием" && text.includes("Точно да")) continue;
      if (titleKeyword === "Точно нет" && text.includes("С условием")) continue;
      targetEl = el;
    }
  }
  
  if (targetEl) {
    let ul = targetEl.querySelector("ul");
    let parent = targetEl.parentElement;
    while (parent && !ul) {
      ul = parent.querySelector("ul");
      parent = parent.parentElement;
    }
    if (!ul) {
      ul = document.createElement("ul");
      ul.style.cssText = "list-style: none; padding: 0; margin-top: 10px; max-height: 450px; overflow-y: auto;";
      targetEl.appendChild(ul);
    }
    return ul;
  }
  return null;
}

function renderExchangeLists() {
  const yesListEl = document.getElementById("exchangesYesList") || getContainerByTitle("Точно да");
  const condListEl = document.getElementById("exchangesCondList") || getContainerByTitle("С условием");
  const noListEl = document.getElementById("exchangesNoList") || getContainerByTitle("Точно нет");

  if (yesListEl) {
    yesListEl.innerHTML = exchangesYes.map(item => `<li style="padding: 5px 8px; margin-bottom: 3px; background: rgba(40,167,69,0.1); border-radius: 4px; color: #fff;">✅ ${item}</li>`).join("");
  }
  
  if (condListEl) {
    condListEl.innerHTML = exchangesCondition.length > 0 
      ? exchangesCondition.map(item => `<li style="padding: 5px 8px; margin-bottom: 3px; background: rgba(255,193,7,0.1); border-radius: 4px; color: #fff;">⚠️ <b>${item.name}</b> — <span style="color: #ffc107;">${item.condition}</span></li>`).join("")
      : "<li style='color: #888; padding: 5px;'>Нет элементов</li>";
  }

  if (noListEl) {
    noListEl.innerHTML = exchangesNo.map(item => `<li style="padding: 5px 8px; margin-bottom: 3px; background: rgba(220,53,69,0.1); border-radius: 4px; color: #fff;">❌ ${item}</li>`).join("");
  }
}

function handleExchangeSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  
  const yesListEl = document.getElementById("exchangesYesList") || getContainerByTitle("Точно да");
  const condListEl = document.getElementById("exchangesCondList") || getContainerByTitle("С условием");
  const noListEl = document.getElementById("exchangesNoList") || getContainerByTitle("Точно нет");

  const filteredYes = exchangesYes.filter(item => item.toLowerCase().includes(query));
  const filteredCond = exchangesCondition.filter(item => item.name.toLowerCase().includes(query) || item.condition.toLowerCase().includes(query));
  const filteredNo = exchangesNo.filter(item => item.toLowerCase().includes(query));

  if (yesListEl) {
    yesListEl.innerHTML = filteredYes.length > 0 
      ? filteredYes.map(item => `<li style="padding: 5px 8px; margin-bottom: 3px; background: rgba(40,167,69,0.1); border-radius: 4px; color: #fff;">✅ ${item}</li>`).join("") 
      : "<li style='color: #888; padding: 5px;'>Ничего не найдено</li>";
  }

  if (condListEl) {
    condListEl.innerHTML = filteredCond.length > 0 
      ? filteredCond.map(item => `<li style="padding: 5px 8px; margin-bottom: 3px; background: rgba(255,193,7,0.1); border-radius: 4px; color: #fff;">⚠️ <b>${item.name}</b> — <span style="color: #ffc107;">${item.condition}</span></li>`).join("") 
      : "<li style='color: #888; padding: 5px;'>Ничего не найдено</li>";
  }

  if (noListEl) {
    noListEl.innerHTML = filteredNo.length > 0 
      ? filteredNo.map(item => `<li style="padding: 5px 8px; margin-bottom: 3px; background: rgba(220,53,69,0.1); border-radius: 4px; color: #fff;">❌ ${item}</li>`).join("") 
      : "<li style='color: #888; padding: 5px;'>Ничего не найдено</li>";
  }
}