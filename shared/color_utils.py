"""
Comprehensive Color Database for Aarya Clothing (Backend)
Synchronized with frontend_new/lib/colorMap.js
"""
import math
import re
from typing import Optional
from functools import lru_cache

# --- Main Color Map (Prioritized clothing names) ---
COLOR_MAP = {
    'Mahendi': '#4A7C59',
    'Rust': '#B7410E',
    'Mustard': '#E3A849',
    'Wine': '#722F37',
    'Burgundy': '#800020',
    'Cream': '#FFFDD0',
    'Peach': '#FFDAB9',
    'Coral': '#FF7F50',
    'Gold': '#FFD700',
    'Silver': '#C0C0C0',
    'Olive': '#808000',
    'Teal': '#14B8A6',
    'Lavender': '#E6E6FA',
    'Lilac': '#C8A2C8',
    'Mauve': '#E0B0FF',
    'Magenta': '#FF00FF',
    'Charcoal': '#36454F',
    'Multicolor': '#FF6B6B',
    'Black': '#000000',
    'White': '#FFFFFF',
    'Red': '#FF0000',
    'Green': '#00FF00',
    'Blue': '#0000FF',
    'Yellow': '#FFFF00',
    'Cyan': '#00FFFF',
    'Aqua': '#00FFFF',
    'Fuchsia': '#FF00FF',
    'Pink': '#FFC0CB',
    'Orange': '#FFA500',
    'Purple': '#800080',
    'Navy': '#000080',
    'Maroon': '#800000',
    'Beige': '#F5F5DC',
    'Ivory': '#FFFFF0',
    'Gray': '#808080',
    'Grey': '#808080',
}

# --- Extended Database (NTC subset) ---
EXTENDED_DATABASE = [
    ["000000", "Black"], ["000080", "Navy Blue"], ["0000C8", "Dark Blue"], ["0000FF", "Blue"],
    ["000741", "Stratos"], ["001B1C", "Swamp"], ["002387", "Resolution Blue"], ["002900", "Deep Fir"],
    ["002E20", "Burnham"], ["002FA7", "International Klein Blue"], ["003153", "Prussian Blue"],
    ["003366", "Midnight Blue"], ["003399", "Smalt"], ["003532", "Deep Teal"], ["003E40", "Cyprus"],
    ["004620", "Kaitoke Green"], ["0047AB", "Cobalt"], ["004816", "Crusoe"], ["004950", "Sherpa Blue"],
    ["0056A7", "Endeavour"], ["00581A", "Camarone"], ["0066CC", "Science Blue"], ["0066FF", "Blue Ribbon"],
    ["00755E", "Tropical Rain Forest"], ["0076A3", "Allports"], ["007BA7", "Deep Cerulean"],
    ["007EC7", "Lochmara"], ["007FFF", "Azure Radiance"], ["008000", "Office Green"], ["008080", "Teal"],
    ["0095B6", "Bondi Blue"], ["009DC4", "Pacific Blue"], ["00A693", "Persian Green"], ["00A86B", "Jade"],
    ["00CC99", "Caribbean Green"], ["00CCCC", "Robin's Egg Blue"], ["00FF00", "Green"], ["00FF7F", "Spring Green"],
    ["00FFFF", "Cyan / Aqua"], ["010D1A", "Blue Charcoal"], ["011635", "Midnight"], ["011D13", "Holly"],
    ["012731", "Cyprus"], ["01361C", "Green House"], ["013E62", "Torea Bay"], ["013F6A", "Venice Blue"],
    ["014B43", "Deep Jungle Green"], ["015E85", "Orient"], ["016162", "Blue Stone"], ["016D39", "Fun Green"],
    ["01796F", "Pine Green"], ["01826B", "Blue Lagoon"], ["01A368", "Deep Sea"], ["022D15", "Genoa"],
    ["02402C", "Endeavour"], ["02478E", "Resolution Blue"], ["024E46", "Deep Sea Green"], ["026395", "Bahama Blue"],
    ["02866F", "Observatory"], ["02A4D3", "Cerulean"], ["03163C", "Tangaroa"], ["032B52", "Green Vogue"],
    ["036A6E", "Mosque"], ["041004", "Midnight Moss"], ["041322", "Black Pearl"], ["042E19", "Blue Whale"],
    ["044022", "Zuccini"], ["044259", "Teal Blue"], ["051040", "Deep Cove"], ["051657", "Gulf Blue"],
    ["055989", "Venice Blue"], ["056F57", "Watercourse"], ["061141", "Catalina Blue"], ["061F41", "Tiber"],
    ["062A78", "Gossamer"], ["063537", "Niagara"], ["069B81", "Tarawera"], ["073A50", "Jaguar"],
    ["080110", "Black Bean"], ["081910", "Deep Sapphire"], ["082567", "Elf Green"], ["088370", "Bright Turquoise"],
    ["08E8DE", "Downriver"], ["092256", "Palm Green"], ["09230F", "Madison"], ["09255D", "Bottle Green"],
    ["093624", "Deep Sea Green"], ["095859", "Salem"], ["097F4B", "Black Russian"], ["0A001C", "Dark Fern"],
    ["0A480D", "Japanese Laurel"], ["0A6906", "Atoll"], ["0A6F75", "Wild Rice"], ["0B0B0B", "Abbey"],
    ["0B0F08", "Black Russian"], ["0B1107", "Indian Tan"], ["0B1304", "Deep Bronze"], ["0B6207", "Japanese Laurel"],
    ["0C0504", "Gun Powder"], ["0C0B1D", "Black Rock"], ["0C1911", "Bunker"], ["0C7A79", "Atoll"],
    ["0C8990", "Turtle Green"], ["0D0332", "Deep Koamaru"], ["0D1117", "Bunker"], ["0D1C19", "Blue Whale"],
    ["0D2E1C", "Zuccini"], ["0E0E18", "Black Rock"], ["0E2A30", "Tiber"], ["0F2D9E", "Showtime"],
    ["10121D", "Black Rock"], ["101405", "Crowshead"], ["101D22", "Rangoon Green"], ["102030", "Deep Teal"],
    ["105852", "Arapawa"], ["110C6C", "Deep Koamaru"], ["113539", "Tiber"], ["11483F", "Blue Whale"],
    ["116062", "Blue Stone"], ["117733", "Green"], ["121910", "Bunker"], ["122007", "Seaweed"],
    ["123447", "Biscay"], ["126B40", "Fun Green"], ["130000", "Black Bean"], ["130A06", "Wood Bark"],
    ["13264D", "Cloud Burst"], ["134F19", "Japanese Laurel"], ["140600", "Cedar"], ["1450AA", "Torea Bay"],
    ["151F4C", "Cloud Burst"], ["1560BD", "Denim"], ["15736B", "Genoa"], ["161911", "Mirage"],
    ["161D10", "Hunter Green"], ["162A40", "Big Stone"], ["163222", "Celtic"], ["16322C", "Timber Green"],
    ["163531", "Gable Green"], ["171F04", "Pine Tree"], ["175579", "Chathams Blue"], ["182D09", "Deep Forest Green"],
    ["18587A", "Blumine"], ["19330E", "Palm Leaf"], ["193751", "Nile Blue"], ["1959A8", "Fun Blue"],
    ["1A1A68", "Lucky Point"], ["1AB385", "Mountain Meadow"], ["1B0245", "Tolopea"], ["1B1035", "Haiti"],
    ["1B127B", "Deep Koamaru"], ["1B1404", "Acadia"], ["1B2F11", "Seaweed"], ["1B3162", "Biscay"],
    ["1B659D", "Matisse"], ["1C1208", "Crowshead"], ["1C1E13", "Rangoon Green"], ["1C39BB", "Persian Blue"],
    ["1C402E", "Everglade"], ["1C7C7D", "Elm"], ["1D6142", "Green Pea"], ["1E0F04", "Creole"],
    ["1E1609", "Karaka"], ["1E1708", "El Paso"], ["1E385B", "Cello"], ["1E433C", "Te Papa Green"],
    ["1E90FF", "Dodger Blue"], ["1E9AB0", "Eastern Blue"], ["1F120F", "Night Rider"], ["1FC2C2", "Java"],
    ["20208D", "Jacksons Purple"], ["202E54", "Cloud Burst"], ["204852", "Blue Whale"], ["211A0E", "Eternity"],
    ["2208E3", "Deep Blue"], ["222F02", "Deep Forest Green"], ["223104", "Fern Frond"], ["22322E", "Timber Green"],
    ["223330", "Gable Green"], ["223457", "Gulf Blue"], ["226C63", "Observatory"], ["232E26", "Jungle Green"],
    ["233418", "Palm Leaf"], ["240A00", "Chocolate"], ["240C02", "Upper Rim"], ["242A1D", "Rolling Stone"],
    ["242E16", "Old Copper"], ["24500F", "Fern Frond"], ["25272C", "Revolver"], ["25311C", "Seaweed"],
    ["25597F", "Chathams Blue"], ["25D7D7", "Caribbean Green"], ["260368", "County Purp"], ["26056A", "Enzian"],
    ["261105", "Wood Bark"], ["261414", "Gondola"], ["262335", "Steel Gray"], ["26283B", "Ebony Clay"],
    ["273A81", "Bay of Many"], ["27504B", "Plantation"], ["278A5B", "Eucalyptus"], ["281E15", "Oil"],
    ["283A27", "Astronaut"], ["286ACD", "Mariner"], ["290C5E", "Violent Violet"], ["292130", "Bastille"],
    ["292319", "Zeus"], ["292937", "Charade"], ["297B9A", "Jelly Bean"], ["29AB87", "Jungle Green"],
    ["2A0359", "Cherry Pie"], ["2A140E", "Coffee Bean"], ["2A2630", "Baltic Sea"], ["2A380B", "Turtle Green"],
    ["2A52BE", "Cerulean Blue"], ["2B0202", "Sepia Black"], ["2B194F", "Valhalla"], ["2B3228", "Heavy Metal"],
    ["2C0E8C", "Blue Gem"], ["2C1632", "Revolver"], ["2C2133", "Bleached Cedar"], ["2C8C84", "Lochinvar"],
    ["2D2510", "Mikado"], ["2D383A", "Outer Space"], ["2D569B", "St Tropaz"], ["2E0329", "Jacaranda"],
    ["2E1905", "Jacko Bean"], ["2E3222", "Rangitoto"], ["2E3F62", "Rhino"], ["2E8B57", "Sea Green"],
    ["2EBFD4", "Scooter"], ["2F270E", "Onion"], ["2F3CB3", "Governor Bay"], ["2F519E", "Sapphire"],
    ["2F5A57", "Spectra"], ["2F6168", "Casal"], ["300529", "Melanzane"], ["301F1E", "Cocoa Bean"],
    ["302011", "Woody Brown"], ["302744", "20000 Leagues Under the Sea"], ["308882", "Atoll"], ["310062", "Deep Violet"],
    ["31160E", "Coffee Bean"], ["312030", "Old Lavender"], ["314459", "Biscay"], ["315BA1", "Matisse"],
    ["31728D", "Ironstone"], ["32127A", "Jacksons Purple"], ["32293A", "Bastille"], ["323232", "Mine Shaft"],
    ["325D52", "Plantation"], ["327C14", "Japanese Laurel"], ["327DA0", "St Tropaz"], ["33036B", "Jacaranda"],
    ["33292F", "Night Rider"], ["33CC99", "Shamrock"], ["341515", "Tamarind"], ["350036", "Mardi Gras"],
    ["350E42", "Valentino"], ["350E57", "Janna"], ["353542", "Abbey"], ["354E8C", "Space Shuttle"],
    ["363050", "Martinique"], ["363534", "Abbey"], ["363C0D", "Mikado"], ["36747D", "Waterspout"],
    ["368716", "Japanese Laurel"], ["370202", "Sepia Black"], ["371D09", "Coffee Bean"], ["37290E", "Mikado"],
    ["373021", "Jambalaya"], ["377475", "Casal"], ["38040E", "Claret"], ["380510", "Black Rose"],
    ["381A51", "Valentino"], ["383533", "Abbey"], ["384448", "Outer Space"], ["386751", "Green Pea"],
    ["39302E", "Woody Brown"], ["393D2A", "Rangitoto"], ["394851", "Rhino"], ["396413", "Japanese Laurel"],
    ["3A0020", "Old Rose"], ["3A2010", "Woody Brown"], ["3A2A6A", "Jacksons Purple"], ["3A5935", "Everglade"],
    ["3A686C", "Casal"], ["3A6A47", "Green Pea"], ["3AB09E", "Tradewind"], ["3B000B", "Black Bean"],
    ["3B0910", "Black Rose"], ["3B1F1F", "Cocoa Bean"], ["3B2820", "Mondo"], ["3B7A57", "Amazon"],
    ["3B91B4", "Boston Blue"], ["3C0878", "Windsor"], ["3C1206", "Cedar"], ["3C1F76", "Jacksons Purple"],
    ["3C2005", "Jacko Bean"], ["3C3910", "Mikado"], ["3C4151", "Bright Gray"], ["3C444D", "Gun Powder"],
    ["3C493A", "Lunar Green"], ["3D0C02", "Bean"], ["3D2B1F", "Bistre"], ["3D7D52", "Goblin"],
    ["3E0480", "Kingfisher Daisy"], ["3E1C14", "Cedar"], ["3E2B23", "English Walnut"], ["3E2C1C", "Black Marlin"],
    ["3E3A44", "Ship Gray"], ["3EABBF", "Pelorous"], ["3F2109", "Bronze"], ["3F2500", "Cola"],
    ["3F3002", "Madras"], ["3F307F", "Victoria"], ["3F4C3A", "Lunar Green"], ["3F583B", "Verun"],
    ["3F5D53", "Mineral Green"], ["401801", "Cedar"], ["40291D", "English Walnut"], ["403B38", "Mine Shaft"],
    ["403D19", "Mikado"], ["404048", "Gun Powder"], ["405169", "Rhino"], ["40826D", "Viridian"],
    ["40A860", "Chateau Green"], ["410012", "Ripe Plum"], ["410056", "Violet"], ["411F10", "Paco"],
    ["412010", "Woody Brown"], ["413C37", "Mine Shaft"], ["414257", "Gun Powder"], ["414C7D", "Gulf Blue"],
    ["4169E1", "Royal Blue"], ["41AA78", "Ocean Green"], ["420303", "Sepia Black"], ["423921", "Mondo"],
    ["427977", "Tradewind"], ["4299AD", "Pelorous"], ["431560", "Loulou"], ["433120", "Bistre"],
    ["433E37", "Mine Shaft"], ["434C59", "Rhino"], ["436A0D", "Mikado"], ["44012D", "Ripe Plum"],
    ["441D00", "Cola"], ["444954", "Gun Powder"], ["454936", "Lunar Green"], ["456CAB", "St Tropaz"],
    ["45B1E8", "Picton Blue"], ["460B41", "Loulou"], ["462425", "Crater Brown"], ["465945", "Mineral Green"],
    ["4682B4", "Steel Blue"], ["480404", "Sepia Black"], ["480607", "Black Rose"], ["480656", "Violet"],
    ["481C08", "Coffee Bean"], ["483131", "Woody Brown"], ["483C32", "Taupe"], ["49170C", "Cedar"],
    ["492615", "Bistre"], ["49371B", "Madras"], ["494404", "Mikado"], ["495400", "Fern Frond"],
    ["496679", "Blumine"], ["497183", "Blumine"], ["4A2A04", "Bronze"], ["4A3004", "Madras"],
    ["4A3C30", "Mondo"], ["4A4244", "Ship Gray"], ["4A444B", "Gun Powder"], ["4A4E5A", "Rhino"],
    ["4B0082", "Indigo"], ["4B058F", "Violet"], ["4B2725", "Crater Brown"], ["4B2D01", "Bronze"],
    ["4B4039", "Mondo"], ["4B433B", "Mondo"], ["4B4D52", "Gun Powder"], ["4B4F54", "Gun Powder"],
    ["4B5D52", "Mineral Green"], ["4C3024", "Paco"], ["4C3D8E", "Victoria"], ["4C514A", "Lunar Green"],
    ["4C5D30", "Fern Frond"], ["4D0135", "Ripe Plum"], ["4D0A18", "Claret"], ["4D1E01", "Bronze"],
    ["4D282D", "Crater Brown"], ["4D282E", "Crater Brown"], ["4D3833", "Mondo"], ["4D3D14", "Mikado"],
    ["4D400F", "Mikado"], ["4D5328", "Rangitoto"], ["4E0606", "Sepia Black"], ["4E2A04", "Bronze"],
    ["4E3B41", "Ship Gray"], ["4E420C", "Mikado"], ["4E4562", "St Tropaz"], ["4E6649", "Mineral Green"],
    ["4E7F9E", "Blumine"], ["4EABD1", "Pelorous"], ["4F013E", "Ripe Plum"], ["4F1C70", "Violet"],
    ["4F2398", "Jacksons Purple"], ["4F69C6", "Royal Blue"], ["4F7942", "Fern Green"], ["4F9D5D", "Chateau Green"],
    ["4FA83D", "Apple"], ["504351", "Ship Gray"], ["50514C", "Lunar Green"], ["505D7E", "Rhino"],
    ["507672", "Spectra"], ["50C878", "Emerald"], ["514100", "Madras"], ["514649", "Ship Gray"],
    ["516E3D", "Fern Frond"], ["517C66", "Observatory"], ["51808E", "Blumine"], ["520031", "Ripe Plum"],
    ["520C17", "Claret"], ["523C94", "Victoria"], ["533454", "Valentino"], ["534491", "Victoria"],
    ["53B0AC", "Tradewind"], ["541012", "Claret"], ["544333", "Mondo"], ["54534D", "Mine Shaft"],
    ["549019", "Japanese Laurel"], ["55280C", "Bronze"], ["555B10", "Mikado"], ["556B2F", "Olive Drab"],
    ["556D56", "Mineral Green"], ["5590D9", "Picton Blue"], ["560319", "Claret"], ["56147D", "Violet"],
    ["566D53", "Mineral Green"], ["56A1A8", "Eastern Blue"], ["56B4BE", "Pelorous"], ["578363", "Goblin"],
    ["583401", "Bronze"], ["585562", "Ship Gray"], ["587156", "Mineral Green"], ["589AAF", "Pelorous"],
    ["591D35", "Ripe Plum"], ["592804", "Bronze"], ["593737", "Woody Brown"], ["594433", "Mondo"],
    ["595954", "Mine Shaft"], ["5A6E41", "Fern Frond"], ["5A87A0", "Blumine"], ["5B3013", "Bronze"],
    ["5B3E90", "Victoria"], ["5B5330", "Mikado"], ["5B5D56", "Mine Shaft"], ["5B6BE1", "Royal Blue"],
    ["5C0120", "Ripe Plum"], ["5C0536", "Ripe Plum"], ["5C2E01", "Bronze"], ["5C5D75", "Ship Gray"],
    ["5D1E0F", "Cedar"], ["5D4C51", "Ship Gray"], ["5D5C58", "Mine Shaft"], ["5D5E37", "Rangitoto"],
    ["5D7747", "Fern Frond"], ["5D8039", "Fern Frond"], ["5E483E", "Mondo"], ["5E5D5B", "Mine Shaft"],
    ["5E60EE", "Royal Blue"], ["5E816F", "Observatory"], ["5F3D26", "Bistre"], ["5F5F6E", "Ship Gray"],
    ["5F6672", "Bright Gray"], ["5F9EA0", "Cadet Blue"], ["5FA777", "Eucalyptus"], ["5FB69C", "Tradewind"],
    ["604913", "Madras"], ["605B73", "Ship Gray"], ["606E68", "Spectra"], ["612718", "Cedar"],
    ["614051", "Ship Gray"], ["615D30", "Mikado"], ["61658F", "St Tropaz"], ["616D30", "Fern Frond"],
    ["61755B", "Mineral Green"], ["61845F", "Goblin"], ["6195ED", "Cornflower Blue"], ["61A15F", "Chateau Green"],
    ["622F30", "Woody Brown"], ["623F2D", "Bistre"], ["624E9A", "Victoria"], ["625119", "Madras"],
    ["626649", "Lunar Green"], ["639A8F", "Tradewind"], ["63B76C", "Chateau Green"], ["6456B7", "Victoria"],
    ["646077", "Ship Gray"], ["646463", "Mine Shaft"], ["646A54", "Lunar Green"], ["646E75", "Bright Gray"],
    ["64AFE3", "Picton Blue"], ["64B613", "Japanese Laurel"], ["65000B", "Black Bean"], ["651A14", "Cedar"],
    ["652DC1", "Violet"], ["657220", "Mikado"], ["65745D", "Mineral Green"], ["658699", "Blumine"],
    ["660045", "Ripe Plum"], ["660099", "Violet"], ["660222", "Ripe Plum"], ["661010", "Claret"],
    ["66B58F", "Tradewind"], ["66FF00", "Bright Green"], ["66FF66", "Screamin' Green"], ["67032D", "Ripe Plum"],
    ["675FA6", "Victoria"], ["676662", "Mine Shaft"], ["67BE90", "Tradewind"], ["683600", "Bronze"],
    ["685558", "Ship Gray"], ["685E6E", "Ship Gray"], ["692545", "Ripe Plum"], ["692D03", "Bronze"],
    ["695F62", "Ship Gray"], ["697E9A", "St Tropaz"], ["6A442E", "Bistre"], ["6A5D1B", "Mikado"],
    ["6A6051", "Mondo"], ["6A7275", "Bright Gray"], ["6B2A14", "Cedar"], ["6B3FA0", "Victoria"],
    ["6B4E31", "Mondo"], ["6B5755", "Ship Gray"], ["6B8E23", "Olive Drab"], ["6C3082", "Violet"],
    ["6C3461", "Ripe Plum"], ["6CDAE7", "Picton Blue"], ["6D0101", "Sepia Black"], ["6D5E54", "Mondo"],
    ["6D6C6C", "Mine Shaft"], ["6D9292", "Tradewind"], ["6E0902", "Bean"], ["6E1D14", "Cedar"],
    ["6E4826", "Bistre"], ["6E4B26", "Bistre"], ["6E6D57", "Rangitoto"], ["6E7783", "Bright Gray"],
    ["6F440C", "Bronze"], ["6F6A61", "Mondo"], ["6F8E63", "Goblin"], ["6F9D81", "Eucalyptus"],
    ["701C1C", "Cedar"], ["704214", "Bronze"], ["704A07", "Bronze"], ["704F50", "Ship Gray"],
    ["706555", "Mondo"], ["70D594", "Tradewind"], ["711A00", "Bronze"], ["71291D", "Cedar"],
    ["714693", "Victoria"], ["714AB2", "Victoria"], ["715D47", "Mondo"], ["716338", "Mikado"],
    ["716B56", "Mondo"], ["716E10", "Mikado"], ["716E61", "Mondo"], ["717486", "Bright Gray"],
    ["718080", "Spectra"], ["71D9E2", "Picton Blue"], ["72010F", "Claret"], ["724A2F", "Bistre"],
    ["726D4E", "Mondo"], ["727B89", "Bright Gray"], ["731E8F", "Violet"], ["734A12", "Bronze"],
    ["736C9F", "Victoria"], ["736D58", "Mondo"], ["737829", "Mikado"], ["738276", "Spectra"],
    ["743362", "Ripe Plum"], ["745937", "Mondo"], ["74640D", "Mikado"], ["747D63", "Mineral Green"],
    ["747D83", "Bright Gray"], ["748881", "Spectra"], ["749378", "Goblin"], ["74C365", "Chateau Green"],
    ["755A57", "Ship Gray"], ["75633D", "Mondo"], ["75663F", "Mondo"], ["75785A", "Rangitoto"],
    ["757A45", "Fern Frond"], ["75AA94", "Tradewind"], ["76395D", "Ripe Plum"], ["7666C6", "Victoria"],
    ["76BD17", "Japanese Laurel"], ["76D7EA", "Picton Blue"], ["770F05", "Cedar"], ["771F1F", "Woody Brown"],
    ["773F1A", "Bronze"], ["776F61", "Mondo"], ["778120", "Mikado"], ["778899", "Light Slate Gray"],
    ["77DD77", "Pastel Green"], ["780109", "Black Bean"], ["782D19", "Cedar"], ["782F16", "Cedar"],
    ["78866B", "Mineral Green"], ["788A25", "Mikado"], ["788BBA", "St Tropaz"], ["7A013A", "Ripe Plum"],
    ["7A58C1", "Victoria"], ["7A7A7A", "Gray"], ["7A89B8", "St Tropaz"], ["7AC488", "Chateau Green"],
    ["7B3801", "Bronze"], ["7B3F00", "Bronze"], ["7B6608", "Mikado"], ["7B7874", "Mine Shaft"],
    ["7B7C94", "Bright Gray"], ["7B8265", "Mineral Green"], ["7B9F80", "Goblin"], ["7BA05B", "Chateau Green"],
    ["7C1C05", "Cedar"], ["7C7631", "Mikado"], ["7C778A", "Ship Gray"], ["7C7B7A", "Mine Shaft"],
    ["7C7B82", "Ship Gray"], ["7C89B3", "St Tropaz"], ["7C8C71", "Mineral Green"], ["7D1A1A", "Woody Brown"],
    ["7D2C14", "Cedar"], ["7D3910", "Bronze"], ["7D3F16", "Bronze"], ["7D76D8", "Royal Blue"],
    ["7D786A", "Mondo"], ["7D7974", "Mine Shaft"], ["7D8061", "Mineral Green"], ["7D8471", "Mineral Green"],
    ["7E3A15", "Bronze"], ["7F175D", "Ripe Plum"], ["7F2401", "Bronze"], ["7F3A02", "Bronze"],
    ["7F626D", "Ship Gray"], ["7F75D3", "Royal Blue"], ["7F76D3", "Royal Blue"], ["7F7D14", "Mikado"],
    ["7F8F18", "Mikado"], ["7FFF00", "Chartreuse"], ["7FFFD4", "Aquamarine"], ["800000", "Maroon"],
    ["800080", "Purple"], ["800B47", "Ripe Plum"], ["801818", "Woody Brown"], ["80341F", "Cedar"],
    ["80371F", "Cedar"], ["80461B", "Bronze"], ["807E79", "Mine Shaft"], ["808000", "Olive"],
    ["808080", "Gray"], ["80B3AE", "Tradewind"], ["80B3C4", "Pelorous"], ["80CCEA", "Picton Blue"],
    ["81422C", "Bistre"], ["816E71", "Ship Gray"], ["817377", "Ship Gray"], ["819885", "Goblin"],
    ["826F65", "Mondo"], ["828685", "Bright Gray"], ["828F72", "Mineral Green"], ["831923", "Claret"],
    ["83446B", "Ripe Plum"], ["83D0C6", "Tradewind"], ["843179", "Ripe Plum"], ["844273", "Ripe Plum"],
    ["84A0A0", "Spectra"], ["8581D9", "Royal Blue"], ["858470", "Mondo"], ["859FAF", "Blumine"],
    ["85C4CC", "Pelorous"], ["860111", "Black Bean"], ["863C3C", "Woody Brown"], ["86483C", "Bistre"],
    ["864D1E", "Bronze"], ["86560A", "Mikado"], ["868974", "Mineral Green"], ["86949F", "Bright Gray"],
    ["871550", "Ripe Plum"], ["87756E", "Mondo"], ["878D91", "Bright Gray"], ["87A96B", "Chateau Green"],
    ["87CEEB", "Sky Blue"], ["87CEFA", "Light Sky Blue"], ["885342", "Bistre"], ["886221", "Mikado"],
    ["888387", "Bright Gray"], ["888D65", "Mineral Green"], ["893456", "Ripe Plum"], ["893820", "Cedar"],
    ["894425", "Bistre"], ["89742E", "Mikado"], ["897D6D", "Mondo"], ["8A3324", "Cedar"],
    ["8A73D6", "Royal Blue"], ["8A8360", "Mondo"], ["8A8389", "Bright Gray"], ["8A8F8A", "Bright Gray"],
    ["8AB9F1", "Picton Blue"], ["8B0000", "Dark Red"], ["8B00FF", "Electric Violet"], ["8B0723", "Claret"],
    ["8B6B0B", "Mikado"], ["8B8470", "Mondo"], ["8B847E", "Ship Gray"], ["8B8680", "Mine Shaft"],
    ["8B9C90", "Bright Gray"], ["8B9FEE", "Royal Blue"], ["8BA690", "Eucalyptus"], ["8BE6D8", "Tradewind"],
    ["8C055E", "Ripe Plum"], ["8C472F", "Bistre"], ["8C5738", "Bistre"], ["8C6495", "Victoria"],
    ["8D0226", "Claret"], ["8D3D38", "Woody Brown"], ["8D3F3F", "Woody Brown"], ["8D7662", "Mondo"],
    ["8D8974", "Mineral Green"], ["8D90A1", "Bright Gray"], ["8DA8B0", "Pelorous"], ["8E0000", "Black Bean"],
    ["8E4A33", "Bistre"], ["8E60EE", "Royal Blue"], ["8E775E", "Mondo"], ["8E8145", "Mikado"],
    ["8E8D70", "Mineral Green"], ["8E948F", "Bright Gray"], ["8EABC1", "St Tropaz"], ["8F021C", "Claret"],
    ["8F3E33", "Woody Brown"], ["8F4B0E", "Bronze"], ["8F8176", "Mondo"], ["8F8F8E", "Gray"],
    ["8F9482", "Mineral Green"], ["8F9E9E", "Spectra"], ["8FADAC", "Tradewind"], ["8FB69C", "Tradewind"],
    ["900020", "Burgundy"], ["901E1E", "Woody Brown"], ["907874", "Ship Gray"], ["907B71", "Mondo"],
    ["908D39", "Mikado"], ["914448", "Ship Gray"], ["915F33", "Bistre"], ["916530", "Bistre"],
    ["918151", "Mikado"], ["91A092", "Bright Gray"], ["92060A", "Black Bean"], ["924321", "Bistre"],
    ["926F5B", "Mondo"], ["928573", "Mondo"], ["928590", "Ship Gray"], ["928984", "Mine Shaft"],
    ["928E6C", "Mineral Green"], ["929791", "Bright Gray"], ["9370DB", "Medium Purple"], ["93CCEA", "Picton Blue"],
    ["93DFB8", "Tradewind"], ["944747", "Woody Brown"], ["948771", "Mondo"], ["948E90", "Ship Gray"],
    ["949394", "Mine Shaft"], ["94A2B3", "Bright Gray"], ["94B21C", "Mikado"], ["94B452", "Chateau Green"],
    ["951703", "Bronze"], ["952E31", "Woody Brown"], ["954448", "Ship Gray"], ["954535", "Chestnut"],
    ["956231", "Bistre"], ["956387", "Victoria"], ["959396", "Mine Shaft"], ["959AD4", "Royal Blue"],
    ["95AE9C", "Eucalyptus"], ["95AFBA", "St Tropaz"], ["95B9C7", "Pelorous"], ["964B00", "Brown"],
    ["967059", "Mondo"], ["9678B6", "Victoria"], ["967BB6", "Victoria"], ["968D99", "Ship Gray"],
    ["969A91", "Bright Gray"], ["96A8A1", "Spectra"], ["96BBAB", "Tradewind"], ["97605D", "Ship Gray"],
    ["9771B5", "Victoria"], ["97D5B3", "Tradewind"], ["983D61", "Ripe Plum"], ["9874D3", "Royal Blue"],
    ["98777B", "Ship Gray"], ["98811B", "Mikado"], ["988D77", "Mondo"], ["988F14", "Mikado"],
    ["98939A", "Mine Shaft"], ["989F1C", "Mikado"], ["98A11C", "Mikado"], ["98B4D4", "St Tropaz"],
    ["98FF98", "Mint Green"], ["990066", "Ripe Plum"], ["991100", "Black Bean"], ["991613", "Cedar"],
    ["991B07", "Cedar"], ["996666", "Copper Rose"], ["9966CC", "Amethyst"], ["997A8D", "Ship Gray"],
    ["9999CC", "Blue Bell"], ["9A3820", "Cedar"], ["9A6E61", "Mondo"], ["9A9577", "Mondo"],
    ["9AB973", "Chateau Green"], ["9ACD32", "Yellow Green"], ["9B4703", "Bronze"], ["9B9E8F", "Mineral Green"],
    ["9C3336", "Woody Brown"], ["9C7E41", "Mikado"], ["9C8D72", "Mondo"], ["9C9C9C", "Gray"],
    ["9D5616", "Bronze"], ["9D6127", "Bronze"], ["9D8003", "Mikado"], ["9D8ABF", "Victoria"],
    ["9DBBCC", "Pelorous"], ["9E5B40", "Bistre"], ["9EA587", "Mineral Green"], ["9EA91F", "Mikado"],
    ["9EB1CD", "St Tropaz"], ["9ED1FF", "Picton Blue"], ["9F381D", "Cedar"], ["9F821C", "Mikado"],
    ["9F9D91", "Bright Gray"], ["9F9F9C", "Mine Shaft"], ["9FA3A7", "Bright Gray"], ["9FD7D3", "Tradewind"],
    ["A02712", "Cedar"], ["A14743", "Ship Gray"], ["A15858", "Woody Brown"], ["A1750D", "Mikado"],
    ["A1ADB5", "Bright Gray"], ["A1C50A", "Mikado"], ["A1DAD7", "Tradewind"], ["A2006D", "Ripe Plum"],
    ["A23B6C", "Ripe Plum"], ["A26645", "Bistre"], ["A2A2D0", "Blue Bell"], ["A2A580", "Mineral Green"],
    ["A3807B", "Ship Gray"], ["A39760", "Mondo"], ["A3E3ED", "Picton Blue"], ["A4A49D", "Mine Shaft"],
    ["A4A6D3", "Blue Bell"], ["A4AF6E", "Chateau Green"], ["A50B5E", "Ripe Plum"], ["A52A2A", "Brown"],
    ["A59B91", "Mondo"], ["A5CB0C", "Mikado"], ["A62F20", "Cedar"], ["A65529", "Bistre"],
    ["A68B5B", "Mondo"], ["A69279", "Mondo"], ["A6A29A", "Mine Shaft"], ["A6A29D", "Mine Shaft"],
    ["A6D6D7", "Tradewind"], ["A72525", "Woody Brown"], ["A78356", "Mondo"], ["A8251E", "Cedar"],
    ["A84421", "Bistre"], ["A84441", "Ship Gray"], ["A84535", "Chestnut"], ["A85307", "Bronze"],
    ["A86515", "Bronze"], ["A86B6B", "Copper Rose"], ["A8692F", "Bistre"], ["A8989B", "Ship Gray"],
    ["A8A589", "Mineral Green"], ["A8AE9F", "Bright Gray"], ["A8AF8E", "Mineral Green"], ["A8BD9F", "Eucalyptus"],
    ["A8E3BD", "Tradewind"], ["A98B2D", "Mikado"], ["A9A491", "Mondo"], ["A9ACB6", "Bright Gray"],
    ["A9B2C3", "St Tropaz"], ["A9B4D2", "St Tropaz"], ["A9BD9F", "Eucalyptus"], ["A9D1D7", "Tradewind"],
    ["AA375A", "Ripe Plum"], ["AA4203", "Bronze"], ["AA8B2D", "Mikado"], ["AA8D6F", "Mondo"],
    ["AAA5A9", "Ship Gray"], ["AAA9CD", "Blue Bell"], ["AAABB7", "Bright Gray"], ["AAB1BB", "Bright Gray"],
    ["AAC0E8", "Picton Blue"], ["AAD6E6", "Picton Blue"], ["AAF0D1", "Magic Mint"], ["AB0563", "Ripe Plum"],
    ["AB3472", "Ripe Plum"], ["AB917A", "Mondo"], ["ABA0D9", "Royal Blue"], ["ABA196", "Mondo"],
    ["ABAC11", "Mikado"], ["ABC112", "Mikado"], ["ABD0E6", "Picton Blue"], ["ABD475", "Chateau Green"],
    ["ABE8F4", "Picton Blue"], ["AC8A56", "Mondo"], ["AC91CE", "Victoria"], ["AC9E22", "Mikado"],
    ["ACA494", "Mondo"], ["ACA586", "Mineral Green"], ["ACA59A", "Mondo"], ["ACACAC", "Gray"],
    ["ACBA9D", "Eucalyptus"], ["AD7810", "Mikado"], ["ADBED1", "Bright Gray"], ["ADDFAD", "Moss Green"],
    ["ADFF2F", "Green Yellow"], ["AE4560", "Ripe Plum"], ["AE6020", "Bronze"], ["AE809E", "Victoria"],
    ["AF4035", "Chestnut"], ["AF4D43", "Ship Gray"], ["AF593E", "Bistre"], ["AF8751", "Mondo"],
    ["AF8F2C", "Mikado"], ["AF9F1C", "Mikado"], ["AFA09E", "Ship Gray"], ["AFB1B8", "Bright Gray"],
    ["AFBDD9", "St Tropaz"], ["AFE3D6", "Tradewind"], ["AFEEEE", "Pale Turquoise"], ["AFF0BE", "Tradewind"],
    ["B05D54", "Woody Brown"], ["B05E13", "Bronze"], ["B06608", "Mikado"], ["B09A95", "Ship Gray"],
    ["B0A99F", "Mondo"], ["B0BA46", "Chateau Green"], ["B0BEBE", "Bright Gray"], ["B0C4DE", "Light Steel Blue"],
    ["B0E0E6", "Powder Blue"], ["B11030", "Claret"], ["B14A0B", "Bronze"], ["B1610B", "Bronze"],
    ["B16D52", "Bistre"], ["B19461", "Mondo"], ["B1E2C1", "Tradewind"], ["B1F4E7", "Tradewind"],
    ["B20931", "Claret"], ["B22222", "Fire Brick"], ["B2944B", "Mikado"], ["B2A1EA", "Royal Blue"],
    ["B2AAB9", "Ship Gray"], ["B2ABA5", "Mondo"], ["B2B195", "Mineral Green"], ["B2B7B1", "Bright Gray"],
    ["B2C6B1", "Eucalyptus"], ["B2D4DD", "Pelorous"], ["B31B1B", "Woody Brown"], ["B32D29", "Woody Brown"],
    ["B35213", "Bronze"], ["B38007", "Mikado"], ["B3AF95", "Mineral Green"], ["B3C110", "Mikado"],
    ["B3D324", "Chateau Green"], ["B3E2D1", "Tradewind"], ["B3F6E4", "Tradewind"], ["B43332", "Woody Brown"],
    ["B44668", "Ripe Plum"], ["B4CFD3", "Pelorous"], ["B57281", "Ship Gray"], ["B57EDC", "Lavender"],
    ["B5A27F", "Mondo"], ["B5B35C", "Olive Drab"], ["B5D2CE", "Tradewind"], ["B5ECDF", "Tradewind"],
    ["B6316C", "Ripe Plum"], ["B69D98", "Ship Gray"], ["B6B095", "Mineral Green"], ["B6BAA4", "Mineral Green"],
    ["B6D1EA", "Picton Blue"], ["B6D3BF", "Eucalyptus"], ["B7410E", "Bronze"], ["B78E5C", "Mondo"],
    ["B7A214", "Mikado"], ["B7A458", "Mikado"], ["B7B1B1", "Bright Gray"], ["B7C3D0", "Bright Gray"],
    ["B7F0BE", "Tradewind"], ["B81104", "Cedar"], ["B87333", "Copper"], ["B8860B", "Dark Goldenrod"],
    ["B8B56A", "Olive Drab"], ["B8C1B1", "Eucalyptus"], ["B8C25D", "Chateau Green"], ["B8E0F9", "Picton Blue"],
    ["B94E48", "Ship Gray"], ["B95140", "Chestnut"], ["B98D28", "Mikado"], ["B9C46A", "Chateau Green"],
    ["B9C8AC", "Eucalyptus"], ["BA0101", "Black Bean"], ["BA450C", "Bronze"], ["BA6F1E", "Bronze"],
    ["BA7F03", "Mikado"], ["BAB1A2", "Mondo"], ["BAB411", "Mikado"], ["BAC7C9", "Bright Gray"],
    ["BAEEF9", "Picton Blue"], ["BB3385", "Ripe Plum"], ["BB8983", "Ship Gray"], ["BBD009", "Mikado"],
    ["BBD7C1", "Eucalyptus"], ["BCC9C2", "Bright Gray"], ["BD5E2E", "Bistre"], ["BD978E", "Ship Gray"],
    ["BDB1A8", "Mondo"], ["BDB2A1", "Mondo"], ["BDB3C7", "Blue Bell"], ["BDB76B", "Dark Khaki"],
    ["BDBBD7", "Blue Bell"], ["BDBDC6", "Bright Gray"], ["BDC8B3", "Eucalyptus"], ["BDC9CE", "Bright Gray"],
    ["BDEDFD", "Picton Blue"], ["BE33FF", "Electric Purple"], ["BEA448", "Mikado"], ["BEB5B7", "Ship Gray"],
    ["BEB728", "Mikado"], ["BEBD7F", "Olive Drab"], ["BEBDBE", "Bright Gray"], ["BEDE0D", "Chateau Green"],
    ["BEE7F5", "Picton Blue"], ["BF5500", "Bronze"], ["BFB8B0", "Mondo"], ["BFBED8", "Blue Bell"],
    ["BFC1C2", "Bright Gray"], ["BFC921", "Chateau Green"], ["BFDBE2", "Pelorous"], ["BFFF00", "Bitter Lemon"],
    ["C02B18", "Cedar"], ["C04737", "Chestnut"], ["C08081", "Ship Gray"], ["C0C0C0", "Silver"],
    ["C0D3B9", "Eucalyptus"], ["C0D8B6", "Eucalyptus"], ["C1440E", "Bronze"], ["C154C1", "Fuchsia"],
    ["C1A004", "Mikado"], ["C1B7A4", "Mondo"], ["C1BAB0", "Mondo"], ["C1BECD", "Blue Bell"],
    ["C1D7B0", "Eucalyptus"], ["C1F07C", "Chateau Green"], ["C21717", "Woody Brown"], ["C26B03", "Bronze"],
    ["C2955D", "Mondo"], ["C2BDB6", "Mondo"], ["C2CAC4", "Bright Gray"], ["C2E8E5", "Tradewind"],
    ["C32148", "Bright Maroon"], ["C3B091", "Khaki"], ["C3B091", "Mondo"], ["C3BFC1", "Bright Gray"],
    ["C3C3BD", "Mine Shaft"], ["C3CDE6", "Picton Blue"], ["C3D1D1", "Bright Gray"], ["C3DDF9", "Picton Blue"],
    ["C41E3A", "Cardinal"], ["C45655", "Woody Brown"], ["C45719", "Bronze"], ["C4C4BC", "Mine Shaft"],
    ["C4D0B0", "Eucalyptus"], ["C4F4EB", "Tradewind"], ["C5817E", "Ship Gray"], ["C59922", "Mikado"],
    ["C5994B", "Mondo"], ["C5DBCA", "Eucalyptus"], ["C5E17A", "Chateau Green"], ["C62D42", "Woody Brown"],
    ["C69191", "Copper Rose"], ["C6A84B", "Mikado"], ["C6C3B5", "Mondo"], ["C6C5D7", "Blue Bell"],
    ["C6D1FF", "Picton Blue"], ["C6E610", "Chateau Green"], ["C70315", "Black Bean"], ["C71585", "Medium Violet Red"],
    ["C7BCA2", "Mondo"], ["C7C1FF", "Royal Blue"], ["C7C4BF", "Mine Shaft"], ["C7C9D5", "Bright Gray"],
    ["C7CD90", "Chateau Green"], ["C7DDE1", "Pelorous"], ["C7F2E1", "Tradewind"], ["C8385A", "Ripe Plum"],
    ["C83B1E", "Cedar"], ["C8ADAC", "Ship Gray"], ["C8C1C0", "Ship Gray"], ["C8C5D1", "Bright Gray"],
    ["C8D051", "Chateau Green"], ["C8E3D7", "Tradewind"], ["C96323", "Bronze"], ["C99415", "Mikado"],
    ["C9A0DC", "Wisteria"], ["C9B29B", "Mondo"], ["C9B35B", "Mikado"], ["C9BBC2", "Ship Gray"],
    ["C9C0BB", "Ship Gray"], ["C9C310", "Mikado"], ["C9C6C0", "Mine Shaft"], ["C9C9C6", "Mine Shaft"],
    ["C9D9D2", "Tradewind"], ["C9FFA2", "Chateau Green"], ["CA3435", "Woody Brown"], ["CABB48", "Mikado"],
    ["CADCD4", "Tradewind"], ["CAE00D", "Chateau Green"], ["CAE6DA", "Tradewind"], ["CB8E16", "Mikado"],
    ["CBA92B", "Mikado"], ["CBACA9", "Ship Gray"], ["CBCAB6", "Mineral Green"], ["CBD3B0", "Eucalyptus"],
    ["CBDBD6", "Tradewind"], ["CC3333", "Persian Red"], ["CC5500", "Burnt Orange"], ["CC7722", "Ochre"],
    ["CC8899", "Puce"], ["CCCAA8", "Mineral Green"], ["CCCCFF", "Periwinkle"], ["CCFF00", "Electric Lime"],
    ["CD5700", "Bronze"], ["CD5C5C", "Indian Red"], ["CD8429", "Bronze"], ["CDA500", "Mikado"],
    ["CDA800", "Mikado"], ["CDB891", "Mondo"], ["CDD7D0", "Bright Gray"], ["CDDBE2", "Pelorous"],
    ["CDDC1B", "Chateau Green"], ["CEB98F", "Mondo"], ["CEBABA", "Ship Gray"], ["CEC7A7", "Mondo"],
    ["CEDA5B", "Chateau Green"], ["CEFA05", "Chateau Green"], ["CF7320", "Bronze"], ["CFD7D2", "Bright Gray"],
    ["CFE5D2", "Eucalyptus"], ["CFE5D3", "Eucalyptus"], ["CFEBE8", "Tradewind"], ["CFEBBF", "Eucalyptus"],
    ["D05F04", "Bronze"], ["D06DA1", "Ripe Plum"], ["D07D12", "Mikado"], ["D0BEF8", "Royal Blue"],
    ["D0C0B0", "Mondo"], ["D0F0C0", "Tea Green"], ["D18F1B", "Mikado"], ["D1BEA8", "Mondo"],
    ["D1C6B4", "Mondo"], ["D1D2CA", "Mine Shaft"], ["D1D2DD", "Blue Bell"], ["D1E231", "Chateau Green"],
    ["D2691E", "Chocolate"], ["D27D46", "Bistre"], ["D29EAA", "Copper Rose"], ["D2B48C", "Tan"],
    ["D2B48C", "Mondo"], ["D2DA97", "Chateau Green"], ["D2E2E7", "Pelorous"], ["D2F6EE", "Tradewind"],
    ["D2FF00", "Chateau Green"], ["D31241", "Ripe Plum"], ["D3CBBA", "Mondo"], ["D3CDC5", "Mondo"],
    ["D47494", "Ripe Plum"], ["D4C6A8", "Mondo"], ["D4CD16", "Mikado"], ["D4D7D9", "Bright Gray"],
    ["D4DFE2", "Pelorous"], ["D4E2FC", "Picton Blue"], ["D54600", "Bronze"], ["D591A4", "Copper Rose"],
    ["D59A6F", "Mondo"], ["D5D195", "Chateau Green"], ["D5D6D3", "Bright Gray"], ["D5DB95", "Chateau Green"],
    ["D5E7E2", "Tradewind"], ["D69188", "Copper Rose"], ["D6C562", "Mikado"], ["D6D1C0", "Mondo"],
    ["D6D6D1", "Mine Shaft"], ["D6FF97", "Chateau Green"], ["D7837F", "Ship Gray"], ["D7C498", "Mondo"],
    ["D7D0FF", "Royal Blue"], ["D84437", "Chestnut"], ["D87C63", "Bistre"], ["D8BFD8", "Thistle"],
    ["D8C2D5", "Blue Bell"], ["D8FCFA", "Picton Blue"], ["D94972", "Ripe Plum"], ["D99376", "Bistre"],
    ["D9B99B", "Mondo"], ["D9D6CF", "Mine Shaft"], ["D9DCC1", "Eucalyptus"], ["D9E4F5", "Picton Blue"],
    ["D9F7FF", "Picton Blue"], ["DA3287", "Ripe Plum"], ["DA5B38", "Bistre"], ["DA6304", "Bronze"],
    ["DA6A41", "Bistre"], ["DA70D6", "Orchid"], ["DA8A67", "Bistre"], ["DAA520", "Goldenrod"],
    ["DAECD6", "Eucalyptus"], ["DAF4F0", "Tradewind"], ["DAFAFF", "Picton Blue"], ["DB244F", "Ripe Plum"],
    ["DB5079", "Ripe Plum"], ["DB9690", "Copper Rose"], ["DBA520", "Goldenrod"], ["DBDBDB", "Silver"],
    ["DBFFF8", "Tradewind"], ["DC143C", "Crimson"], ["DC4333", "Woody Brown"], ["DCB20C", "Mikado"],
    ["DCB4BC", "Ship Gray"], ["DCD747", "Mikado"], ["DCD9D2", "Mine Shaft"], ["DCDDCC", "Mineral Green"],
    ["DCEDB4", "Chateau Green"], ["DCF0EA", "Tradewind"], ["DDD6D5", "Ship Gray"], ["DDE26A", "Chateau Green"],
    ["DDEAF6", "Picton Blue"], ["DDF9F1", "Tradewind"], ["DE3163", "Cerise"], ["DE6341", "Bistre"],
    ["DEA681", "Bistre"], ["DEBA13", "Mikado"], ["DEC196", "Mondo"], ["DECBC6", "Ship Gray"],
    ["DED4A4", "Mondo"], ["DED717", "Mikado"], ["DEE5C0", "Eucalyptus"], ["DEF5FF", "Picton Blue"],
    ["DF73FF", "Heliotrope"], ["DFBE6F", "Mikado"], ["DFCD6F", "Mikado"], ["DFCF11", "Mikado"],
    ["DFE3E3", "Bright Gray"], ["DFEFEF", "Tradewind"], ["DFEFF3", "Pelorous"], ["E03C31", "Woody Brown"],
    ["E05D5E", "Woody Brown"], ["E08D3C", "Bronze"], ["E0B0FF", "Mauve"], ["E0D7DB", "Ship Gray"],
    ["E0E4DC", "Bright Gray"], ["E16865", "Woody Brown"], ["E1BC64", "Mikado"], ["E1C0C8", "Ship Gray"],
    ["E1E6D6", "Bright Gray"], ["E1EAD4", "Eucalyptus"], ["E1F6E8", "Tradewind"], ["E25465", "Woody Brown"],
    ["E2725B", "Terra Cotta"], ["E28913", "Mikado"], ["E292C0", "Ripe Plum"], ["E29418", "Mikado"],
    ["E29CD2", "Ripe Plum"], ["E2D8ED", "Blue Bell"], ["E2EBED", "Pelorous"], ["E2F3EC", "Tradewind"],
    ["E30B5C", "Raspberry"], ["E32636", "Alizarin Crimson"], ["E34234", "Cinnabar"], ["E3BEBE", "Ship Gray"],
    ["E3F5E1", "Eucalyptus"], ["E3F988", "Chateau Green"], ["E47627", "Bronze"], ["E49B0F", "Mikado"],
    ["E4D422", "Mikado"], ["E4D5B7", "Mondo"], ["E4D69B", "Mondo"], ["E4F6E7", "Tradewind"],
    ["E4FFD1", "Chateau Green"], ["E52B50", "Rose"], ["E5841B", "Bronze"], ["E5CCC9", "Ship Gray"],
    ["E5D7BD", "Mondo"], ["E5D811", "Mikado"], ["E5E0E1", "Bright Gray"], ["E5E5E5", "Silver"],
    ["E5F9F6", "Tradewind"], ["E64E03", "Bronze"], ["E6BE8A", "Mondo"], ["E6D7B9", "Mondo"],
    ["E6E4D4", "Mineral Green"], ["E6F2EA", "Tradewind"], ["E6F8F3", "Tradewind"], ["E6FFE9", "Tradewind"],
    ["E77200", "Bronze"], ["E7730A", "Bronze"], ["E79F8C", "Copper Rose"], ["E7BCB4", "Ship Gray"],
    ["E7BF05", "Mikado"], ["E7CD8C", "Mikado"], ["E7ECE6", "Bright Gray"], ["E7F8FF", "Picton Blue"],
    ["E7FEFF", "Picton Blue"], ["E89928", "Mikado"], ["E8B9B3", "Ship Gray"], ["E8E0D5", "Mondo"],
    ["E8EBE0", "Bright Gray"], ["E8F1D4", "Eucalyptus"], ["E8F2EB", "Tradewind"], ["E8F5F2", "Tradewind"],
    ["E91606", "Black Bean"], ["E94196", "Ripe Plum"], ["E9C615", "Mikado"], ["E9DB64", "Mikado"],
    ["E9D9A9", "Mondo"], ["E9E3E3", "Bright Gray"], ["E9F8ED", "Tradewind"], ["E9FFFD", "Picton Blue"],
    ["EA88A8", "Copper Rose"], ["EAAE69", "Mondo"], ["EAB33B", "Mikado"], ["EAC674", "Mikado"],
    ["EADAB8", "Mondo"], ["EAE8D4", "Mineral Green"], ["EAE9D8", "Mineral Green"], ["EAEBCA", "Mineral Green"],
    ["EAF6EE", "Tradewind"], ["EAF6FF", "Picton Blue"], ["EAF9F5", "Tradewind"], ["EB9373", "Bistre"],
    ["EBC2AF", "Mondo"], ["EBD414", "Mikado"], ["EBD662", "Mikado"], ["EBDE97", "Mondo"],
    ["EBE5D5", "Mondo"], ["EBF115", "Chateau Green"], ["EBF2EE", "Tradewind"], ["EBF3E5", "Eucalyptus"],
    ["EBF3F3", "Bright Gray"], ["EBF9F9", "Tradewind"], ["EC7625", "Bronze"], ["ECA927", "Mikado"],
    ["ECCE8E", "Mikado"], ["ECF245", "Chateau Green"], ["ED7A1C", "Bronze"], ["ED9121", "Carrot Orange"],
    ["ED989E", "Copper Rose"], ["EDB381", "Bistre"], ["EDC9AF", "Desert Sand"], ["EDCDAB", "Mondo"],
    ["EDDCB1", "Mondo"], ["EDEA99", "Chateau Green"], ["EDF5F5", "Bright Gray"], ["EDF5FF", "Picton Blue"],
    ["EDF6FF", "Picton Blue"], ["EDF9F1", "Tradewind"], ["EDFCFF", "Picton Blue"], ["EE82EE", "Violet"],
    ["EEC1BE", "Ship Gray"], ["EED794", "Mikado"], ["EED9C4", "Mondo"], ["EEDC82", "Flax"],
    ["EEDDED", "Blue Bell"], ["EEE333", "Mikado"], ["EEEEEE", "Silver"], ["EEF0C8", "Mineral Green"],
    ["EEF3C3", "Eucalyptus"], ["EEF4DE", "Eucalyptus"], ["EEF6F7", "Pelorous"], ["EEFDFF", "Picton Blue"],
    ["EEFF9A", "Chateau Green"], ["EEFFF1", "Tradewind"], ["EF863F", "Bronze"], ["EFA053", "Bronze"],
    ["EFBA16", "Mikado"], ["EFD743", "Mikado"], ["EFD929", "Mikado"], ["EFDB8A", "Mikado"],
    ["EFEFEF", "Silver"], ["EFF2F3", "Bright Gray"], ["F08080", "Light Coral"], ["F091A9", "Copper Rose"],
    ["F0D52D", "Mikado"], ["F0E2EC", "Blue Bell"], ["F0E68C", "Khaki"], ["F0EEFD", "Blue Bell"],
    ["F0F8FF", "Alice Blue"], ["F0FCEA", "Eucalyptus"], ["F18200", "Bronze"], ["F19BAB", "Copper Rose"],
    ["F1E788", "Mikado"], ["F1E9D2", "Mondo"], ["F1EA7D", "Mikado"], ["F1F1F1", "Silver"],
    ["F1F7F2", "Tradewind"], ["F1FFAD", "Chateau Green"], ["F1FFC8", "Chateau Green"], ["F2552A", "Bistre"],
    ["F28500", "Tangerine"], ["F2C3B2", "Ship Gray"], ["F2F2F2", "Silver"], ["F2FAFA", "Tradewind"],
    ["F34723", "Bistre"], ["F3AD16", "Mikado"], ["F3D69D", "Mondo"], ["F3D9DF", "Ship Gray"],
    ["F3E7BB", "Mondo"], ["F3E9E5", "Ship Gray"], ["F3EDCF", "Mondo"], ["F3FB62", "Chateau Green"],
    ["F3FBD4", "Eucalyptus"], ["F3FFAD", "Chateau Green"], ["F40061", "Ripe Plum"], ["F4A460", "Sandy Brown"],
    ["F4C430", "Saffron"], ["F4D81C", "Mikado"], ["F4EBD3", "Mondo"], ["F4F2EE", "Ship Gray"],
    ["F4F4F4", "Silver"], ["F4F8FF", "Picton Blue"], ["F57584", "Ship Gray"], ["F5C85C", "Mikado"],
    ["F5F3E5", "Mondo"], ["F5F5DC", "Beige"], ["F5F5F5", "White Smoke"], ["F5FB3D", "Chateau Green"],
    ["F5FFBE", "Chateau Green"], ["F64A8A", "Ripe Plum"], ["F653A6", "Ripe Plum"], ["F6A4C9", "Copper Rose"],
    ["F6F0E6", "Mondo"], ["F6F7F7", "Bright Gray"], ["F6FFDC", "Chateau Green"], ["F7468A", "Ripe Plum"],
    ["F77703", "Bronze"], ["F77FBE", "Copper Rose"], ["F780A1", "Copper Rose"], ["F7C8DA", "Ship Gray"],
    ["F7DBE6", "Ship Gray"], ["F7F2E1", "Mondo"], ["F7F5FA", "Blue Bell"], ["F7FAF7", "Tradewind"],
    ["F8B853", "Mikado"], ["F8C3DF", "Ship Gray"], ["F8D9E9", "Ship Gray"], ["F8DB2D", "Mikado"],
    ["F8F0E8", "Mondo"], ["F8F4FF", "Magnolia"], ["F8F6F1", "Mondo"], ["F8F7F2", "Mondo"],
    ["F8F8F8", "Silver"], ["F8F99C", "Chateau Green"], ["F8FACD", "Chateau Green"], ["F96292", "Ripe Plum"],
    ["F9D3BE", "Mondo"], ["F9EAF3", "Ship Gray"], ["F9F8E4", "Mineral Green"], ["F9FF8B", "Chateau Green"],
    ["FA7814", "Bronze"], ["FA9D5A", "Bistre"], ["FAD3A2", "Mondo"], ["FADFAD", "Peach Yellow"],
    ["FAE600", "Mikado"], ["FAEAB9", "Mondo"], ["FAEBD7", "Antique White"], ["FAF0E6", "Linen"],
    ["FAF3F0", "Ship Gray"], ["FAF7D6", "Mondo"], ["FAFAFA", "Silver"], ["FAFDE4", "Mineral Green"],
    ["FAFFAD", "Chateau Green"], ["FAFFB7", "Chateau Green"], ["FB607F", "Brink Pink"], ["FB8989", "Copper Rose"],
    ["FBA0E3", "Ripe Plum"], ["FBA129", "Mikado"], ["FBAC13", "Mikado"], ["FBCCE7", "Ship Gray"],
    ["FBCEB1", "Apricot Peach"], ["FBE7B2", "Banana Mania"], ["FBE870", "Mikado"], ["FBE96C", "Mikado"],
    ["FBEA8C", "Mikado"], ["FBEC5D", "Mikado"], ["FBF9F9", "Silver"], ["FBFFBA", "Chateau Green"],
    ["FC0FC0", "Fuchsia"], ["FC80A5", "Copper Rose"], ["FC9C1D", "Mikado"], ["FCC01E", "Mikado"],
    ["FCD667", "Mikado"], ["FCD917", "Mikado"], ["FCDA98", "Mondo"], ["FCF4D0", "Mondo"],
    ["FCF4DC", "Mondo"], ["FCF8F7", "Ship Gray"], ["FCFBF3", "Mondo"], ["FCFFF9", "Tradewind"],
    ["FD0E35", "Torch Red"], ["FD5B78", "Wild Watermelon"], ["FD7B33", "Bronze"], ["FD7C07", "Bronze"],
    ["FD9FA2", "Copper Rose"], ["FDB147", "Mikado"], ["FDBE02", "Mikado"], ["FDC1C5", "Ship Gray"],
    ["FDC501", "Mikado"], ["FDD5B1", "Mondo"], ["FDD7E4", "Ship Gray"], ["FDE1DC", "Ship Gray"],
    ["FDE295", "Mikado"], ["FDE910", "Mikado"], ["FDF5E6", "Old Lace"], ["FDF6D3", "Mondo"],
    ["FDF7AD", "Chateau Green"], ["FDFEB8", "Chateau Green"], ["FDFFD5", "Eucalyptus"], ["FE28A2", "Ripe Plum"],
    ["FE4C40", "Woody Brown"], ["FE6F5E", "Woody Brown"], ["FE9D04", "Bronze"], ["FEA904", "Bronze"],
    ["FEBAAD", "Ship Gray"], ["FED33C", "Mikado"], ["FED85D", "Mikado"], ["FEDB8D", "Mikado"],
    ["FEE5AC", "Mikado"], ["FEEBF3", "Ship Gray"], ["FEEFCE", "Mondo"], ["FEF0EC", "Ship Gray"],
    ["FEF2C7", "Mondo"], ["FEF3D8", "Mondo"], ["FEF4CC", "Mondo"], ["FEF4DB", "Mondo"],
    ["FEF4F8", "Ship Gray"], ["FEF5F1", "Ship Gray"], ["FEF7DE", "Mondo"], ["FEF8E2", "Mondo"],
    ["FEF8FF", "Alice Blue"], ["FEF9E3", "Mondo"], ["FEFCED", "Mondo"], ["FEFEE9", "Mineral Green"],
    ["FEFFCE", "Chateau Green"], ["FEFFD8", "Eucalyptus"], ["FEFFE2", "Mineral Green"], ["FF0000", "Red"],
    ["FF007F", "Rose"], ["FF00FF", "Magenta / Fuchsia"], ["FF1493", "Deep Pink"], ["FF2400", "Scarlet"],
    ["FF3399", "Wild Strawberry"], ["FF33CC", "Razzle Dazzle Rose"], ["FF355E", "Radical Red"],
    ["FF3F34", "Woody Brown"], ["FF4040", "Coral Red"], ["FF4D00", "Vermilion"], ["FF4F00", "International Orange"],
    ["FF6037", "Outrageous Orange"], ["FF6600", "Blaze Orange"], ["FF66FF", "Pink Flamingo"],
    ["FF681F", "Orange-Red"], ["FF69B4", "Hot Pink"], ["FF6B53", "Woody Brown"], ["FF6FFF", "Blush Pink"],
    ["FF7034", "Burning Orange"], ["FF7518", "Pumpkin"], ["FF7D07", "Flamenco"], ["FF7F00", "Flush Orange"],
    ["FF7F50", "Coral"], ["FF8C00", "Dark Orange"], ["FF9000", "Pizazz"], ["FF910F", "West Side"],
    ["FF91A4", "Pink Salmon"], ["FF9933", "Neon Carrot"], ["FF9966", "Atomic Tangerine"], ["FF99FF", "Pink Lace"],
    ["FF9E2C", "Monza"], ["FFA000", "Amber"], ["FFA194", "Copper Rose"], ["FFA500", "Orange"],
    ["FFA6C9", "Carnation Pink"], ["FFAB81", "Bistre"], ["FFAE42", "Yellow Orange"], ["FFB0AC", "Ship Gray"],
    ["FFB1B3", "Ship Gray"], ["FFB31F", "Mikado"], ["FFB513", "Mikado"], ["FFB7D5", "Ship Gray"],
    ["FFB97B", "Mondo"], ["FFBA00", "Mikado"], ["FFBD5F", "Mikado"], ["FFBF00", "Amber"],
    ["FFC0CB", "Pink"], ["FFC3C0", "Ship Gray"], ["FFC901", "Mikado"], ["FFCC00", "Tangerine Yellow"],
    ["FFCC33", "Sunglow"], ["FFCC5B", "Mikado"], ["FFCC99", "Peach-Orange"], ["FFCD8C", "Mikado"],
    ["FFD1DC", "Pink"], ["FFD2B7", "Mondo"], ["FFD38C", "Mikado"], ["FFD700", "Gold"], ["FFD800", "Mikado"],
    ["FFD8D9", "Ship Gray"], ["FFDB58", "Mustard"], ["FFDCD6", "Ship Gray"], ["FFDDAF", "Mondo"],
    ["FFDDD5", "Ship Gray"], ["FFDDAF", "Mondo"], ["FFDDD5", "Ship Gray"], ["FFDDF4", "Ship Gray"],
    ["FFDEAD", "Navajo White"], ["FFDEB3", "Mondo"], ["FFE1AF", "Mondo"], ["FFE1F2", "Ship Gray"],
    ["FFE2C5", "Mondo"], ["FFE4C4", "Bisque"], ["FFE4E1", "Misty Rose"], ["FFE5A0", "Mikado"],
    ["FFE5B4", "Peach"], ["FFE6C7", "Mondo"], ["FFE772", "Mikado"], ["FFEAC8", "Mondo"],
    ["FFEAD4", "Mondo"], ["FFEBAD", "Mikado"], ["FFEDBC", "Mondo"], ["FFEDCD", "Mondo"],
    ["FFEE82", "Mikado"], ["FFEE99", "Mikado"], ["FFEFC1", "Mondo"], ["FFEFD5", "Papaya Whip"],
    ["FFEFEC", "Ship Gray"], ["FFF01F", "Mikado"], ["FFF0DB", "Mondo"], ["FFF0F5", "Lavender Blush"],
    ["FFF14F", "Mikado"], ["FFF1B5", "Mondo"], ["FFF1D8", "Mondo"], ["FFF1EE", "Ship Gray"],
    ["FFF200", "Yellow"], ["FFF2C3", "Mondo"], ["FFF2F2", "Ship Gray"], ["FFF3D7", "Mondo"],
    ["FFF3F1", "Ship Gray"], ["FFF46E", "Mikado"], ["FFF4A2", "Mikado"], ["FFF4CE", "Mondo"],
    ["FFF4DD", "Mondo"], ["FFF4E0", "Mondo"], ["FFF4E8", "Mondo"], ["FFF4F3", "Ship Gray"],
    ["FFF5EE", "Sea Shell"], ["FFF5F3", "Ship Gray"], ["FFF6D4", "Mondo"], ["FFF6F9", "Ship Gray"],
    ["FFF7AD", "Mikado"], ["FFF7C1", "Mondo"], ["FFF7D6", "Mondo"], ["FFF7F0", "Mondo"],
    ["FFF8D1", "Mondo"], ["FFF9E2", "Mondo"], ["FFF9E6", "Mondo"], ["FFFACD", "Lemon Chiffon"],
    ["FFFAF0", "Floral White"], ["FFFAF4", "Mondo"], ["FFFBDC", "Mondo"], ["FFFBF9", "Ship Gray"],
    ["FFFC99", "Mikado"], ["FFFCEA", "Mondo"], ["FFFCEE", "Mondo"], ["FFFDD0", "Cream"],
    ["FFFDE6", "Mondo"], ["FFFDE8", "Mondo"], ["FFFDF3", "Mondo"], ["FFFDF4", "Mondo"],
    ["FFFEEC", "Mondo"], ["FFFEEF", "Mondo"], ["FFFF00", "Yellow"], ["FFFF66", "Laser Lemon"],
    ["FFFF99", "Pale Canary"], ["FFFFB4", "Mikado"], ["FFFFF0", "Ivory"], ["FFFFFF", "White"]
]

# Pre-calculate RGB for the search database to avoid repetitive hex parsing
_SEARCH_DB_RGB = []
for name, ch in COLOR_MAP.items():
    ch_clean = ch.replace("#", "")
    _SEARCH_DB_RGB.append({
        "name": name,
        "r": int(ch_clean[0:2], 16),
        "g": int(ch_clean[2:4], 16),
        "b": int(ch_clean[4:6], 16),
        "is_priority": True
    })

for ch_clean, name in EXTENDED_DATABASE:
    _SEARCH_DB_RGB.append({
        "name": name,
        "r": int(ch_clean[0:2], 16),
        "g": int(ch_clean[2:4], 16),
        "b": int(ch_clean[4:6], 16),
        "is_priority": False
    })

# Reverse lookup: hex -> name
HEX_TO_NAME = {hex_code.upper(): name for name, hex_code in COLOR_MAP.items()}


def get_color_name(hex_code: Optional[str]) -> Optional[str]:
    """Get exact color name from hex."""
    if not hex_code:
        return None
    upper = hex_code.replace("#", "").upper()
    
    # Check main map
    if f"#{upper}" in HEX_TO_NAME:
        return HEX_TO_NAME[f"#{upper}"]
        
    # Check extended database
    for h, name in EXTENDED_DATABASE:
        if h == upper:
            return name
    return None


@lru_cache(maxsize=2048)
def get_nearest_color_name(hex_code: Optional[str]) -> str:
    """
    Finds the mathematically closest color name using Euclidean distance.
    Prioritizes COLOR_MAP for recognizable clothing names.
    """
    if not hex_code:
        return "Default"
    
    # 1. Exact match
    exact = get_color_name(hex_code)
    if exact:
        return exact

    # 2. Parse RGB
    h = hex_code.replace("#", "").upper()
    if len(h) != 6:
        return "Custom"
    
    try:
        r1 = int(h[0:2], 16)
        g1 = int(h[2:4], 16)
        b1 = int(h[4:6], 16)
    except ValueError:
        return "Custom"

    min_distance = float('inf')
    closest_name = "Custom"

    # 3. Optimized Search
    for color in _SEARCH_DB_RGB:
        # Euclidean distance formula
        distance = math.sqrt((r1 - color["r"])**2 + (g1 - color["g"])**2 + (b1 - color["b"])**2)
        
        # Immediate return for "Proper" clothing names within threshold
        if color["is_priority"] and distance < 30:
            return color["name"]
            
        if distance < min_distance:
            min_distance = distance
            closest_name = color["name"]

    return closest_name


def get_hex_from_name(name: Optional[str]) -> Optional[str]:
    """Get hex code from color name (fuzzy match)."""
    if not name:
        return None
    
    name_lower = name.lower().strip()
    
    # Exact match in COLOR_MAP
    for color_name, hex_code in COLOR_MAP.items():
        if color_name.lower() == name_lower:
            return hex_code
            
    # Fuzzy match hex code in name string
    hex_match = re.search(r'#([0-9a-fA-F]{6})', name)
    if hex_match:
        return f"#{hex_match.group(1).upper()}"
        
    # Exact match in Extended DB
    for hex_code, color_name in EXTENDED_DATABASE:
        if color_name.lower() == name_lower:
            return f"#{hex_code}"
            
    # Partial match
    for color_name, hex_code in COLOR_MAP.items():
        if color_name.lower() in name_lower or name_lower in color_name.lower():
            return hex_code
            
    return None
