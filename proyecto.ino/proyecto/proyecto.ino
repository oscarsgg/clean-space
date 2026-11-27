#include <SPI.h>
#include <MFRC522.h>
#include <DHT.h>
#include <ESP32Servo.h>

// ==================== PINES SEGUN DIAGRAMA 2D FINAL ====================
// RFID MFRC522 (SPI - 3.3V)
#define PIN_RFID_SDA   5
#define PIN_RFID_SCK   18
#define PIN_RFID_MOSI  23
#define PIN_RFID_MISO  19
#define PIN_RFID_RST   22

// Sensores conectados (DHT11 y PIR)
#define PIN_DHT        4
#define PIN_PIR        34

// Actuadores, LEDs, Zumbador pasivo y Botón de salida
#define PIN_SERVO      13
#define PIN_LED_VERDE  26
#define PIN_LED_ROJO   27
#define PIN_LED_AMBAR  14
#define PIN_BUZZER     33
#define PIN_BOTON      21

// Objetos
MFRC522 rfid(PIN_RFID_SDA, PIN_RFID_RST);
DHT dht(PIN_DHT, DHT11);
Servo puertaServo;

bool rfidConectado = false;
unsigned long ultimaLecturaMs = 0;
unsigned long ultimoBotonMs = 0;

void probarSalidas() {
  Serial.println("\n[PRUEBA SALIDAS] Probando LEDs (Verde -> Ambar -> Rojo), Buzzer y Servo...");
  digitalWrite(PIN_LED_VERDE, HIGH); delay(300); digitalWrite(PIN_LED_VERDE, LOW);
  digitalWrite(PIN_LED_AMBAR, HIGH); delay(300); digitalWrite(PIN_LED_AMBAR, LOW);
  digitalWrite(PIN_LED_ROJO, HIGH);  delay(300); digitalWrite(PIN_LED_ROJO, LOW);

  tone(PIN_BUZZER, 2000, 180);
  delay(250);
  tone(PIN_BUZZER, 2600, 180);
  delay(250);
  noTone(PIN_BUZZER);

  puertaServo.write(90);
  delay(500);
  puertaServo.write(0);
  delay(300);
  Serial.println("[PRUEBA SALIDAS] Completada.\n");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n========================================");
  Serial.println("  CLEANSPACE - DIAGNOSTICO DE SENSORES  ");
  Serial.println("========================================");

  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_LED_VERDE, OUTPUT);
  pinMode(PIN_LED_ROJO, OUTPUT);
  pinMode(PIN_LED_AMBAR, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_BOTON, INPUT_PULLUP);

  // Reservar timer propio para el Servo y evitar conflicto con tone() del buzzer
  ESP32PWM::allocateTimer(0);
  puertaServo.setPeriodHertz(50);
  puertaServo.attach(PIN_SERVO, 500, 2400);
  puertaServo.write(0);

  dht.begin();

  SPI.begin(PIN_RFID_SCK, PIN_RFID_MISO, PIN_RFID_MOSI, PIN_RFID_SDA);
  rfid.PCD_Init();
  byte versionRfid = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (versionRfid == 0x00 || versionRfid == 0xFF) {
    rfidConectado = false;
    Serial.println("[RFID MFRC522] Aun no conectado (se omite sin bloquear).");
  } else {
    rfidConectado = true;
    Serial.print("[RFID MFRC522] OK - Version chip: 0x");
    Serial.println(versionRfid, HEX);
  }

  probarSalidas();

  Serial.println("Tip: Envia 't' en el Monitor Serial para repetir prueba de LEDs/Buzzer/Servo.");
  Serial.println("Leyendo sensores cada 2 segundos...\n");
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 't' || c == 'T') {
      probarSalidas();
    }
  }

  // Botón físico de salida (4 patas en diagonal -> D21 y GND)
  if (digitalRead(PIN_BOTON) == LOW && (millis() - ultimoBotonMs > 500)) {
    ultimoBotonMs = millis();
    Serial.println(">>> [BOTON SALIDA] Presionado! Activando LED Verde, Buzzer y Servo...");
    digitalWrite(PIN_LED_VERDE, HIGH);
    tone(PIN_BUZZER, 2200, 120);
    puertaServo.write(90);
    delay(1200);
    puertaServo.write(0);
    digitalWrite(PIN_LED_VERDE, LOW);
    noTone(PIN_BUZZER);
  }

  // Lectura RFID automática en cuanto conectes el módulo
  if (rfidConectado && rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    Serial.print(">>> [RFID] Tarjeta leida UID: ");
    for (byte i = 0; i < rfid.uid.size; i++) {
      if (rfid.uid.uidByte[i] < 0x10) Serial.print("0");
      Serial.print(rfid.uid.uidByte[i], HEX);
      if (i < rfid.uid.size - 1) Serial.print("-");
    }
    Serial.println();
    digitalWrite(PIN_LED_VERDE, HIGH);
    tone(PIN_BUZZER, 2500, 120);
    delay(300);
    digitalWrite(PIN_LED_VERDE, LOW);
    noTone(PIN_BUZZER);
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // Reporte cada 2 segundos de DHT11 y PIR
  if (millis() - ultimaLecturaMs >= 2000) {
    ultimaLecturaMs = millis();

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    int pir = digitalRead(PIN_PIR);

    Serial.println("----- LECTURA ACTUAL -----");

    if (isnan(temp) || isnan(hum)) {
      Serial.println("DHT11     : NO detectado (revisar pin D4, 3.3V o resistencia 10k)");
    } else {
      Serial.print("DHT11     : Temp = ");
      Serial.print(temp, 1);
      Serial.print(" C | Humedad = ");
      Serial.print(hum, 1);
      Serial.println(" %");
    }

    Serial.print("PIR (D34) : ");
    Serial.println(pir == HIGH ? "MOVIMIENTO DETECTADO" : "Sin movimiento");

    if (!rfidConectado) {
      Serial.println("RFID      : Pendiente de conectar");
    }
    Serial.println("--------------------------\n");
  }
}