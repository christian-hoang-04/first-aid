package vn.hexacare.sosnow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.hexacare.sosnow.model.SosAlert;
import java.util.List;

public interface SosAlertRepository extends JpaRepository<SosAlert, String> {
    List<SosAlert> findTop20ByOrderByCreatedAtDesc();
}
