// ─── Game Data ───────────────────────────────────────────────────────────────
const CATEGORIES = {
  futbolistas: {
    label: "Jugadores de Fútbol", icon: "⚽",
    words: ["Messi", "Cristiano Ronaldo", "Neymar", "Mbappé", "Haaland", "Benzema", "Lewandowski", "Salah", "De Bruyne", "Modric", "Vinicius Jr", "Pedri", "Gavi", "Bellingham", "Lautaro Martínez", "Álvarez", "Dybala", "Di María", "Rooney", "Gerrard", "Lampard", "Beckham", "Henry", "Zidane", "Ronaldinho", "Maradona", "Pelé", "Buffon", "Casillas", "Neuer", "Ter Stegen", "De Gea", "Oblak", "Courtois", "Alisson", "Ramos", "Piqué", "Varane", "Trent Alexander-Arnold", "Marcelo"],
  },
  selecciones: {
    label: "Selecciones de Fútbol", icon: "🏆",
    words: ["Argentina", "Brasil", "Francia", "Alemania", "España", "Portugal", "Italia", "Inglaterra", "Países Bajos", "Bélgica", "Uruguay", "Colombia", "México", "Japón", "Senegal", "Marruecos", "Ghana", "Ecuador", "Perú", "Chile", "Paraguay", "Australia", "Croacia", "Suiza", "Dinamarca", "Polonia", "Suecia", "Serbia", "Turquía", "Ucrania"],
  },
  actores: {
    label: "Actores Famosos", icon: "🎬",
    words: ["Tom Hanks", "Brad Pitt", "Leonardo DiCaprio", "Angelina Jolie", "Meryl Streep", "Scarlett Johansson", "Robert Downey Jr", "Johnny Depp", "Will Smith", "Denzel Washington", "Morgan Freeman", "Anthony Hopkins", "Cate Blanchett", "Natalie Portman", "Julia Roberts", "Jennifer Aniston", "Sandra Bullock", "Nicole Kidman", "Ryan Reynolds", "Ryan Gosling", "Chris Evans", "Chris Hemsworth", "Dwayne Johnson", "Keanu Reeves", "Joaquin Phoenix", "Tom Cruise", "Harrison Ford", "Al Pacino", "Robert De Niro", "Jack Nicholson", "Penélope Cruz", "Antonio Banderas", "Salma Hayek"],
  },
  historicos: {
    label: "Personajes Históricos", icon: "📜",
    words: ["Napoleón Bonaparte", "Julio César", "Alejandro Magno", "Cleopatra", "Leonardo Da Vinci", "Albert Einstein", "Isaac Newton", "Galileo Galilei", "Charles Darwin", "Nikola Tesla", "Marie Curie", "Abraham Lincoln", "Winston Churchill", "Genghis Khan", "Marco Polo", "Cristóbal Colón", "Martin Luther King", "Nelson Mandela", "Gandhi", "Simon Bolívar", "San Martín", "Fidel Castro", "Che Guevara", "Mozart", "Beethoven", "Shakespeare", "Cervantes", "Aristóteles", "Platón", "Sócrates"],
  },
  objetos: {
    label: "Objetos Cotidianos", icon: "🪑",
    words: ["Silla", "Mesa", "Televisor", "Teléfono", "Computadora", "Refrigerador", "Lavadora", "Microondas", "Cama", "Almohada", "Espejo", "Reloj", "Lámpara", "Ventilador", "Aspiradora", "Cafetera", "Tostadora", "Licuadora", "Plancha", "Tijeras", "Martillo", "Destornillador", "Paraguas", "Mochila", "Maleta", "Billetera", "Bolígrafo", "Cuaderno", "Zapatos", "Gafas de sol", "Taza", "Vaso", "Plato", "Olla", "Sartén", "Cuchillo", "Tabla de cortar"],
  },
  animales: {
    label: "Animales", icon: "🦁",
    words: ["León", "Tigre", "Elefante", "Jirafa", "Hipopótamo", "Rinoceronte", "Cebra", "Gorila", "Delfín", "Ballena", "Tiburón", "Pulpo", "Tortuga marina", "Águila", "Pingüino", "Flamenco", "Pavo real", "Colibrí", "Búho", "Perro", "Gato", "Conejo", "Panda", "Koala", "Canguro", "Ornitorrinco", "Anaconda", "Cobra", "Camaleón", "Caballo", "Vaca", "Cerdo", "Oveja", "Camello", "Axolotl"],
  },
  paises: {
    label: "Países del Mundo", icon: "🌍",
    words: ["China", "India", "Estados Unidos", "Indonesia", "Brasil", "Nigeria", "Japón", "Egipto", "Alemania", "Francia", "Reino Unido", "España", "Italia", "Argentina", "Colombia", "Canadá", "Australia", "Corea del Sur", "Arabia Saudita", "Sudáfrica", "Marruecos", "Suecia", "Noruega", "Dinamarca", "Finlandia", "Suiza", "Austria", "Bélgica", "Polonia", "Perú", "Chile", "Ecuador", "Bolivia", "Cuba", "Jamaica"],
  },
  comidas: {
    label: "Comidas del Mundo", icon: "🍕",
    words: ["Pizza", "Sushi", "Tacos", "Ramen", "Paella", "Spaghetti", "Hamburguesa", "Asado", "Empanadas", "Ceviche", "Arepas", "Tamales", "Enchiladas", "Churros", "Croissant", "Fondue", "Gyros", "Falafel", "Hummus", "Shawarma", "Curry", "Pad Thai", "Pho", "Bibimbap", "Kimchi", "Dim Sum", "Mole", "Locro", "Carbonada", "Milanesa", "Choripán", "Alfajores", "Feijoada", "Brigadeiro", "Dulce de leche"],
  },
  deportes: {
    label: "Deportes", icon: "🏅",
    words: ["Fútbol", "Basketball", "Tenis", "Natación", "Atletismo", "Boxeo", "Ciclismo", "Golf", "Rugby", "Béisbol", "Volleyball", "Handball", "Hockey sobre hielo", "Esquí", "Snowboard", "Surf", "Escalada", "Triatlón", "Esgrima", "Judo", "Karate", "Taekwondo", "Lucha libre", "Halterofilia", "Gimnasia artística", "Patinaje artístico", "Polo", "Tiro con arco", "Vela", "Squash", "Padel"],
  },
  musicos: {
    label: "Músicos Famosos", icon: "🎸",
    words: ["Michael Jackson", "Elvis Presley", "The Beatles", "Queen", "Rolling Stones", "Led Zeppelin", "Pink Floyd", "David Bowie", "Bob Dylan", "Jimi Hendrix", "Madonna", "Whitney Houston", "Beyoncé", "Rihanna", "Shakira", "Taylor Swift", "Ariana Grande", "Lady Gaga", "Adele", "Ed Sheeran", "Bruno Mars", "The Weeknd", "Eminem", "Jay-Z", "Kanye West", "Drake", "Bad Bunny", "J Balvin", "Daddy Yankee", "Luis Fonsi", "Celia Cruz", "Julio Iglesias", "Chayanne", "Ricky Martin", "Gloria Estefan"],
  },
};

module.exports = { CATEGORIES };
