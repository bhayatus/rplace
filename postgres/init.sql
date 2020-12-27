
CREATE TABLE IF NOT EXISTS latest_changes (
    ip_address TEXT PRIMARY KEY,
    last_updated_timestamp TIMESTAMP
);

CREATE TABLE IF NOT EXISTS full_history (
    ip_address TEXT,
    last_updated_timestamp TIMESTAMP,
    x_coord INTEGER,
    y_coord INTEGER,
    color INTEGER,
    PRIMARY KEY (ip_address, last_updated_timestamp)
);

CREATE OR REPLACE FUNCTION update_board(address TEXT, x INTEGER, y INTEGER, color INTEGER, curr_time TIMESTAMP) RETURNS BIGINT AS $$

DECLARE
	last_time_ms BIGINT;

BEGIN
	
	SELECT EXTRACT(EPOCH FROM last_updated_timestamp) FROM latest_changes WHERE ip_address = address INTO last_time_ms;
	
	IF last_time_ms IS NULL THEN
		-- First time updating board
		INSERT INTO full_history(ip_address, last_updated_timestamp, x_coord, y_coord, color) VALUES(address, curr_time, x, y, color);
		INSERT INTO latest_changes(ip_address, last_updated_timestamp) VALUES(address, curr_time);
		RETURN 0;
	ELSE
		-- User has updated board before
		UPDATE latest_changes SET last_updated_timestamp=curr_time WHERE ip_address=address;
		INSERT INTO full_history(ip_address, last_updated_timestamp, x_coord, y_coord, color) VALUES(address, curr_time, x, y, color);
		RETURN 0;
	END IF;

END
$$ language plpgsql;